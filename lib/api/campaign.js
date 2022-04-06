'use strict';

const config = require('config');
const axios = require('axios');

var create = async (req, res, data) => {
    // create conversation thread
    const url = `${config.SMS.campaignAPI}`;
    var campaign = {
        "crm_client_id": data.client,
        "crm_list_id": data.list_id,
        "crm_campaign_id": data.cmp_id,
        "crm_campaign_name": data.cmp_name,
        "use_automated_content_moderation": data.use_automated_content_moderation,
        "automated_content_negative_score": data.automated_content_negative_score,
        "status": "Active"
    };
    console.log("Campaign data:", url, ' -> ', campaign);

    let resAPI = await axios.post(url, campaign);
    console.log("Campaign Create API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

var get = async (req, res, data) => {

    const url = `${config.SMS.campaignAPI}/${data.list_id}/${data.cmp_id}`;
    console.log("Campaign GET:", url);

    let resAPI = await axios.get(url);
    console.log("Campaign API response:", JSON.stringify(resAPI.data));

    return resAPI;
};


var inc = async (req, res, data) => {

    const url = `${config.SMS.campaignAPI}/${data.list_id}/${data.cmp_id}`;
    console.log("Campaign INC:", url);

    let resAPI = await axios.put(url, {});
    console.log("Campaign API response:", JSON.stringify(resAPI.data));
};

module.exports = {
    create: create,
    inc: inc,
    get: get
};