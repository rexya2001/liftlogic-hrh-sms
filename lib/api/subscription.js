'use strict';

const config = require('config');
const axios = require('axios');

var create = async (req, res, data) => {
    // create subscription thread
    const url = `${config.SMS.subscriptionAPI}`;
    var subscription = {
        "crm_list_id": data.list_id,
        "crm_campaign_id": data.cmp_id,
        "crm_uid": data.id,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "email": data.email,
        "phone": res.to || res.destination,
        "did": res.from || res.source || data.did,
        "timezone": data.timezone,
        "status": "New",
        "outgoing_call_id": data.outgoing_call_id,
        "outgoing_call_phone": data.outgoing_call_phone,
        "ll_env_id": data.ll_env_id,
        "carrier": req.carrier,
        "sender_id": data.sender_id,
        "sender_token": data.sender_token,
        "sender_name": data.sender_name,
        "sender_pool_is_active": data.sender_pool_is_active,
        "sender_pool_did": data.sender_pool_did,
        "crm_list_category_id": data.crm_list_category_id,
        "agent_outgoing_call_phone": data.agent_outgoing_call_phone,
        "scheduler_outgoing_call_phone": data.scheduler_outgoing_call_phone
    };

    console.log("Subscription data:", url, ' -> ', subscription);

    let resAPI = await axios.post(url, subscription);
    console.log("Subscription Create API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

var isPhoneInCategory = async (phone, category) => {
    console.log("Subscription GET getByCategoryByPhone:", phone, category);
    let url = `${config.SMS.subscriptionAPI}/search/category/${category}/${phone}`;

    let resAPI = await axios.get(url);
    console.log("Subscription GET getByCategoryByPhone:", JSON.stringify(resAPI.data));

    if (resAPI.data.body.data && resAPI.data.body.data.length > 0) {
        // exists: true
        console.log("!!!!!!!!! Phone is subscribed to category:", phone, category);
        return true;
    } 

    console.log("!!!!!!!!! Phone is NOT subscribed to category:", phone, category);
    return false;
};

module.exports = {
    create: create,
    isPhoneInCategory: isPhoneInCategory
};