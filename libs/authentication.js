/*-----------------------------------------------------------------------------
 **
 ** - Fennel Card-/CalDAV -
 **
 ** Copyright 2014 by
 ** SwordLord - the coding crew - http://www.swordlord.com
 ** and contributing authors
 **
 -----------------------------------------------------------------------------*/

var log = require('../libs/log').log;
var config = require('../config').config;

var htpasswd = require('htpasswd');
var fs = require('fs');
var path = require('path');
//var https = require('https');
var http = require('http');

function checkLogin(username, password, callback)
{
    log.debug("Login process started for user: " + username);

    switch(config.auth_method)
    {
        case 'courier':
            checkCourier(username, password, callback);
            break;

        case 'htaccess':
            checkHtaccess(username, password, callback);
            break;

        case 'api':
            checkApi(username, password, callback);
            break;

        default:
            log.info("No authentication method defined. Denying access.");
            callback(false);
            break;
    }
}

function checkHtaccess(username, password, callback)
{
    log.debug("Authenticating user with htaccess method.");

    var fHTAccess = path.resolve('.', config.auth_method_htaccess_file);

    if(!fs.existsSync(fHTAccess))
    {
        log.warn("File not found for htaccess authentication: " + fHTAccess);
        callback(false);
        return;
    }

    var strHTAccess = fs.readFileSync(fHTAccess, 'utf8');
    var lines = strHTAccess.replace(/\r\n/g, "\n").split("\n");

    for (var i in lines)
    {
        var line = lines[i];
        //log.debug("Read line from htaccess file: " + line);
        if(line.length > 0)
        {
            var ret = processLine(line);
            if(ret.username == username)
            {
                if(htpasswd.verify(ret.passwordhash, password))
                {
                    log.info("User logged in: " + username);
                    callback(true);
                    return;
                }
            }
        }
    }

    log.warn("User could not be logged in. Wrong username or password: " + username);
    callback(false);
}

function processLine(line)
{
    var pwdhash, lineSplit, username;
    lineSplit = line.split(":");
    username = lineSplit.shift();
    pwdhash = lineSplit.join(":");

    return new htaccessLine(username, pwdhash);
};

function htaccessLine(user, hash)
{
    this.username = user;
    this.passwordhash = hash;
};

function checkCourier(username, password, callback)
{
    log.debug("Authenticating user with courier method.");

    var socketPath = config.auth_method_courier_socket;
    log.debug("Using socket: " + socketPath);

    var client = net.createConnection({path: socketPath});

    client.on("connect", function() {
        //console.log('connect');
        var payload = 'service\nlogin\n' + username + '\n' + password;
        client.write('AUTH ' + payload.length + '\n' + payload);
    });

    var response = "";

    client.on("data", function(data) {
        //console.log('data: ' + data);
        response += data.toString();
    });

    client.on('end', function() {
        var result = response.indexOf('FAIL', 0);
        callback(result < 0);
    });
}

function checkApi(username, password, callback)
{
    log.debug("Authenticating user with api method.");

    var postData = {
        email: username,
        password: password
    }

    var postDataString = JSON.stringify(postData);

    var options = {
        host: config.auth_method_api_server,
        port: 80,
        path: config.auth_method_api_session_path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postDataString.length
        }
    }

    var req = http.request(options, function(res) {
      log.debug('STATUS: ' + res.statusCode);
      log.debug('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        log.debug('BODY: ' + chunk);
        callback(res.statusCode === 200);
      });
    });

    // write data to request body
    req.write(postDataString);
    req.end();
}

// Exporting.
module.exports = {
    checkLogin: checkLogin
};