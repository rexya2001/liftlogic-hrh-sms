'use strict';

const config = require('config');
const axios = require('axios');

var isPhoneUnsub = async (phone) => {

    const url = `${config.SMS.unsubAPI}/phone/${phone}`;
    console.log("!!!!! UnsubAPI Get Message:", url);

    let unsubResponse = await axios.get(url);
    console.log("Unsub API response: ", JSON.stringify(unsubResponse.data));
    if (unsubResponse.data.body.data && unsubResponse.data.body.data.length > 0) {
        // unsubscribed: true
        console.log("!!!!!!!!! Phone is unsubscribed");
        return true;
    } 

    return false;
};

var isPhoneUnsubFromCampaign = async (phone, cmp) => {

    const url = `${config.SMS.unsubAPI}/phone/${phone}/cmp/${cmp}`;
    console.log("!!!!! UnsubAPI Get Message:", url);

    let unsubResponse = await axios.get(url);
    console.log("Unsub API response: ", JSON.stringify(unsubResponse.data));
    if (unsubResponse.data.body.data && unsubResponse.data.body.data.length > 0) {
        // unsubscribed: true
        console.log("!!!!!!!!! Phone is unsubscribed");
        return true;
    } 

    return false;
};

var isPhoneUnsubFromCategory = async (phone, category) => {

    const url = `${config.SMS.unsubAPI}/phone/${phone}/category/${category}`;
    console.log("!!!!! UnsubAPI Get Message:", url);

    let unsubResponse = await axios.get(url);
    console.log("Unsub API response: ", JSON.stringify(unsubResponse.data));
    if (unsubResponse.data.body.data && unsubResponse.data.body.data.length > 0) {
        // unsubscribed: true
        console.log("!!!!!!!!! Phone is unsubscribed");
        return true;
    } 

    return false;
};

var create = async (data) => {
    // create subscription thread
    const url = `${config.SMS.unsubAPI}`;
    var subscription = {
        "crm_list_id": data.crm_list_id,
        "crm_campaign_id": data.crm_campaign_id,
        "crm_uid": data.crm_uid,
        "phone": data.phone,
        "did": data.did,
        "email": data.email,
        "src": data.src,
        "reason": data.reason
    };

    console.log("Unsub data:", url, ' -> ', subscription);

    let resAPI = await axios.post(url, subscription);
    console.log("Unsub Create API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

module.exports = {
    create: create,
    isPhoneUnsub: isPhoneUnsub,
    isPhoneUnsubFromCampaign: isPhoneUnsubFromCampaign,
    isPhoneUnsubFromCategory: isPhoneUnsubFromCategory
};