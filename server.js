var http = require('http');
var querystring = require('querystring');
var azure = require('azure');
var request = require('request');
var stream = require('stream');
var util = require('util');
var url = require("url");
var path = require("path");

var blobService = azure.createBlobService('brunostorage', 'YOU GET THIS FROM THE PORTAL UNDER YOUR STORAGE ACCOUNT 8OGSlD7wWHLQA+q3dXmNUOUtBW/liL3a1zc8DevrtlAKnI5wwzg==');

var containerName = 'ppt';

var port = process.env.PORT || 1337;

http.createServer(function(req, res) {
    var body = "";
    req.on('data', function(chunk) {
        body += chunk;
    });

    req.on('end', function() {
        console.log('POSTed: ' + body);
        res.writeHead(200);


        // Break apart submitted form data
        var decodedbody = querystring.parse(body);


        // Parse out the submitted URL
        var parsed = url.parse(decodedbody.sourceurl);

        // Get the filename
        var filename = path.basename(parsed.pathname);

        // Send text to the browser
        var result = "Copying " + decodedbody.sourceurl + "</br> to " +
            filename;
        res.end(result);

        // Start copying to storage account
        loadBase64Image(decodedbody.sourceurl, function (image, prefix) {
            var fileBuffer = new Buffer(image, 'base64');
            blobService.createBlockBlobFromStream(containerName, filename, 
                 new ReadableStreamBuffer(fileBuffer), fileBuffer.length, 
                 { contentTypeHeader: 'image/jpg' }, function (error) {
                //console.log('api result');
                if (!error) {
                    console.log('ok');
                }
                else {
                    console.log(error);
                }

            });
        });

    });



    var downloadImage = function(options, fileName) {
        http.get(options, function(res) {
            var imageData = '';
            res.setEncoding('binary');
            res.on('data', function(chunk) {
                imageData += chunk;
            });
            res.on('end', function() {
                fs.writeFile(fileName, imageData, 'binary', function(err) {
                    if (err) throw err;
                    console.log('File: ' + fileName + " written!");
                });
            });
        });
    };


    var loadBase64Image = function (url, callback) {
        // Required 'request' module

        // Make request to our image url
        request({ url: url, encoding: null }, function (err, res, body) {
            if (!err && res.statusCode == 200) {
                // So as encoding set to null then request body became Buffer object
                var base64prefix = 'data:' + res.headers['content-type'] + ';base64,'
                , image = body.toString('base64');
                if (typeof callback == 'function') {
                    callback(image, base64prefix);
                }
            } else {
                throw new Error('Can not download image');
            }
        });
    };


    var ReadableStreamBuffer = function (fileBuffer) {

        var that = this;
        stream.Stream.call(this);
        this.readable = true;
        this.writable = false;

        var frequency = 50;
        var chunkSize = 1024;
        var size = fileBuffer.length;
        var position = 0;

        var buffer = new Buffer(fileBuffer.length);
        fileBuffer.copy(buffer);

        var sendData = function () {
            if (size === 0) {
                that.emit("end");
                return;
            }

            var amount = Math.min(chunkSize, size);
            var chunk = null;
            chunk = new Buffer(amount);
            buffer.copy(chunk, 0, position, position + amount);
            position += amount;
            size -= amount;

            that.emit("data", chunk);
        };

        this.size = function () {
            return size;
        };

        this.maxSize = function () {
            return buffer.length;
        };

        this.pause = function () {
            if (sendData) {
                clearInterval(sendData.interval);
                delete sendData.interval;
            }
        };

        this.resume = function () {
            if (sendData && !sendData.interval) {
                sendData.interval = setInterval(sendData, frequency);
            }
        };

        this.destroy = function () {
            that.emit("end");
            clearTimeout(sendData.interval);
            sendData = null;
            that.readable = false;
            that.emit("close");
        };

        this.setEncoding = function (_encoding) {
        };

        this.resume();
    };
    util.inherits(ReadableStreamBuffer, stream.Stream);

}).listen(port);