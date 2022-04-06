'use strict';

const config = require('config');
const axios = require('axios');

var create = async (req, res, data) => {
    // create conversation thread
    const url = config.SMS.convoAPI;
    var conversation = {
        "id": res.sid,
        "crm_list_id": data.list_id,
        "crm_campaign_id": data.cmp_id,
        "crm_uid": data.id,
        "ll_env_id": data.ll_env_id,
        "phone": res.to || res.destination,
        "did": res.from || res.source || data.did,
        "event": "sent",
        "direction": "outbound",
        "body": req.body || res.message,
        "processing_center": "teli",
        "template_id": data.template_id
    };
    console.log("Conversation data:", url, ' -> ', conversation);

    let resAPI = await axios.post(url, conversation);
    console.log("Conversation API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

module.exports = {
    create: create
};