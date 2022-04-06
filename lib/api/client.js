'use strict';

const config = require('config');
const axios = require('axios');

var create = async (req, res, data) => {
    // create conversation thread
    const url = `${config.SMS.clientAPI}`;
    var Client = {
        "crm_client_id": data.client,
    };
    console.log("Client data:", url, ' -> ', Client);

    let resAPI = await axios.post(url, Client);
    console.log("Client Create API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

var get = async (req, res, data) => {

    const url = `${config.SMS.clientAPI}/${data.client}`;
    console.log("Client GET:", url);

    let resAPI = await axios.get(url);
    console.log("Client API response:", JSON.stringify(resAPI.data));

    return resAPI;
};

module.exports = {
    create: create,
    get: get,
};