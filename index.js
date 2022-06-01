'use strict';

const config = require('config');
const _ = require("lodash");
const { promisify } = require('util');
const Consumer = require('sqs-consumer');
const commons = require('../liftlogic-commons');
const parsePhoneNumber = require('libphonenumber-js');
const Analytics = require('../liftlogic-analytics');
const {create: createClient, get: getClient} = require('./lib/api/client');
const {create: createCampaign, inc: incLeadCount, get: getCampaign} = require('./lib/api/campaign');
const {create: createSubscription, isPhoneInCategory} = require('./lib/api/subscription');
const {isPhoneUnsub, isPhoneUnsubFromCampaign, isPhoneUnsubFromCategory, create: createUnsub} = require('./lib/api/unsub');
const {create: createConversation} = require('./lib/api/conversation');
const moment = require('moment-timezone');
let analytics = new Analytics("liftlogic");
let stack=[];
var ms = config.throttle.active ? (config.throttle.interval * 1000): 0;
var asyncInterval = require('asyncinterval');
const uuid = require('uuid');
const Handlebars = require("handlebars");
var axios = require('axios');

// require the Hrh module and create a REST client
// const sendSMS = promisify(client.messages.create).bind(client);

require('console-stamp')(console, {
    pattern: 'mmm dd HH:MM:ss.l',
    metadata:'[' + process.pid + ']',
    colors: {
        stamp: "yellow",
        label: "white",
        metadata: "green"
    }
});

var sendEvent = async (evt) => {
    try {
        let e = {
            event: evt.event,
            channel: "sms",
            provider: evt.data.src || "sms",
            email: evt.data.email,
            phone: evt.data.phone,
            list_id: evt.data.list_id,
            zipcode: evt.data.zipcode || evt.data.ZIPCODE || "NULL",
            state: evt.data.state || evt.data.STATE || "NULL",
            src: evt.data.src || evt.data.SRC || "NULL",
            template: evt.data.template_id
        };

        if (evt.event_data) {
            e.event_data = evt.event_data;

        }
        // send event
        console.log("!!!!! Sending Event:" + e.event);
        analytics.track(e, function(err) {
            console.log("!!!!! Event sent.");
        });
    } catch(ex) {
        console.log("!!!!!!!!! Invalid Event", ex);
    }
};

var processSQSMessage = async (message) => {
    let self = this;
    //commons.throttleMeP(config).then(function(c) {
    // do some work with `message`
    var data = JSON.parse(message.Body);
    console.log("!!!!! =====> ", data);
    data = commons.translateValues(data);
    console.log("!!!!! Translate ", data);
    // fix did based on LL TZ
    if (data.did && data.hasOwnProperty(data.did)) {
        data.did = data[data.did];
    }
    console.log("!!!!! Did Translate ", data);

    // fix url date_of_send
    if (data.url) {
        console.log("!!!!! URL Before replace ", data.url);
        data.url = data.url.replace("[SEND_DATE]", moment.utc().tz("America/Los_Angeles").format("YYYYMMDD"));
        console.log("!!!!! URL After replace ", data.url);
    }

    // check filters
    if (commons.isSrcExcluded(data)) {
        console.log("!!!!! Excluded src", data.exclude_src, " =====> ", (data.subid || data.source || data.src));
    } else if (commons.isStateExcluded(data)) {
        console.log("!!!!! Excluded state", data.exclude_state, " =====> ", data.state);
    } else { 
        // shorten url
        commons.shorten(data.url, async (rnus, enus) => {
            if (enus) {
                    console.log("Nus error:", enus);
                    // send event
                    sendEvent({
                        event: "nus_api_error",
                        data: data
                    });
            } else {
                
                const phoneNumber = parsePhoneNumber(data.phone, "US"); // default US

                try {

                    // check if the phone is unsubscribed
                    var isUnsubscribed = false;
                    if (data.use_cmp_unsub) {
                        isUnsubscribed = await isPhoneUnsubFromCampaign(phoneNumber.number, data.cmp_id);
                    } else if (data.use_category_unsub) {
                        isUnsubscribed = await isPhoneUnsubFromCategory(phoneNumber.number, data.crm_list_category_id);
                    } else {
                        isUnsubscribed = await isPhoneUnsub(phoneNumber.number);
                    }

                    // unsubscribed: false
                    if (!isUnsubscribed) {
                        // check for category duplicate
                        var isDuped = false;
                        if (data.use_category_deduper) {
                            isDuped = await isPhoneInCategory(phoneNumber.number, data.crm_list_category_id);
                        }
                        console.log("===> is a category DUPE:", isDuped);
                        if (!isDuped) {

                            let phoneInfo = {};
                            if (data.validate_phone) {
                                let url = `${config.SMS.emailoversightAPI}&phonenumber=${phoneNumber.number}`;
                                console.log("Looking API for number:", phoneNumber.number, " is:", url);
                                let response = await axios.get(url);
                                console.log("Looking API response:", response.data); 
                                phoneInfo = {
                                    carrier: { 
                                        name: response.data.Carrier,
                                        type: response.data.Status,
                                        status: response.data.Type,
                                        error_code: null 
                                    }
                                }
                            } else {
                                // created dummy carrier
                                phoneInfo = {
                                    carrier: { 
                                        name: 'Liftlogic',
                                        type: 'mobile',
                                        status: '',
                                        error_code: null 
                                    }
                                }
                            }
                            
                            // validate phone
                            if (phoneInfo.carrier && phoneInfo.carrier.type && 'mobile' === phoneInfo.carrier.type) {

                                // templetize the template :P
                                const template = Handlebars.compile(data.template_text);
                                const smsBody = template(data.template_data || {});

                                console.log("Nus hash:", rnus.hash);
                                var url = rnus.short_url;
                                if (data.template_domain) {
                                    url = "https://" + data.template_domain + "/" + rnus.hash;
                                }
                                
                                let sms = {
                                    "api_id": data.sender_id || config.hrh.accountSid,
                                    "api_password": data.sender_token || config.hrh.authToken,
                                    "sms_type": "P",
                                    "encoding": "U",
                                    "sender_id": data.did.replace("+", ""),
                                    "phonenumber": phoneNumber.number.replace("+", ""),
                                    "textmessage": smsBody.replace("[URL]", url),
                                    "callback_url": config.hrh.wh
                                };
                                
                                // create client if doesn't exists
                                let ct = await getClient(sms, {}, data);
                                if (ct.data.body.data && _.isEmpty(ct.data.body.data)) {
                                    console.log("!!!!! =====> New client");
                                    ct = await createClient(sms, {}, data);
                                } else {
                                    console.log("!!!!! =====> Existing client");
                                }

                                // create campaign in SMSTrain
                                let cmp = await getCampaign(sms, {}, data);
                                if (cmp.data.body.data && _.isEmpty(cmp.data.body.data)) {
                                    console.log("!!!!! =====> New campaign:");
                                    cmp = await createCampaign(sms, {}, data);
                                } else {
                                    console.log("!!!!! =====> Existing campaign");
                                }

                                let resSms = {
                                    destination: phoneNumber.number,
                                    source: data.did,
                                    message: sms.message,
                                    sid: uuid.v1()
                                };
                                // create subscription
                                await createSubscription(sms, resSms, data);

                                // create  conversation in SMSTrain
                                await createConversation(sms, resSms, data);

                                // inc lead count in SMSTrain for the campaign
                                await incLeadCount(sms, {}, data);

                                console.log("!!!!! Hrh API POST Message:", JSON.stringify(sms));
                                let response = await axios.post(config.hrh.url, sms);
                                console.log("Hrh response:", response.data);
                                console.log("Hrh response id:", response.data.message_id);

                                // send event
                                resSms.api = response.data;
                                resSms.destination = sms.phonenumber;
                                resSms.source = sms.source;
                                resSms.phone = phoneNumber.number;
                                resSms.did = data.did;
                                sendEvent({
                                    event: "sends",
                                    event_data: JSON.stringify(resSms).substring(0, 4000),
                                    data: data
                                });
                            } else {
                                // send event
                                sendEvent({
                                    event: "undeliverable",
                                    event_data: JSON.stringify(phoneInfo).substring(0, 4000),
                                    data: data
                                });                               
                            }
                        } else { // no duplicate record
                            console.log("!!!!! Category dupe detected");
                        }
                    } else { // no unsub record
                        console.log("!!!!! Unsub detected");
                    }
                } catch(ex) {
                    console.log("API error:", ex);

                    if (400 == ex.status && 21610 == ex.code) {
                        // Twilio error: "The message From/To pair violates a blacklist rule."
                        await createUnsub(phoneNumber.number, data);
                    }
                    // send event
                    sendEvent({
                        event: "error",
                        event_data: JSON.stringify(ex).substring(0, 4000),
                        data: data
                    });
                } // end check unsubAPI
            } // end nus no error 
        }); // end call nus API
        //});
    }
}; // end process message

var nextMessage = function() {
    // console.log("!!!!! Delay:", ms, " -> ",stack.length);
    if (stack.length > 0) {
        var msg = stack.pop();
        processSQSMessage(msg);
    } else {
        // console.log("!!!!! Empty stack");
    }
}

var interval = null;

var cnt = 0;
const app = Consumer.create({
    queueUrl: config.SQS.queue,
    handleMessage: (message, done) => {
      //var counter = stack.contents().length;
      console.log("!!!!! Got message:", ++cnt);
      //stack.add(processSQSMessage.bind(stack, message));
      stack.push(message);
      //if (0 == counter) {
      //    stack.next(); // restart queue
      //}
      // @@@@@@@@@
      done();
      if (null == interval) {
          interval = asyncInterval(function(idone){
            nextMessage();
	        idone();
          }, ms);
      }
      console.log("!!!!! Queued message:", cnt);
  }
});

app.on('error', (err) => {
  console.log(err.message);
});

app.start();
console.log("!!!!!!!!! App started");
