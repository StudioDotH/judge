var fs = require('fs-extra');
var path = require('path');
var async = require('async');
var mime = require('mime');
var express = require('express');
var options = require('./../file-settings').options;
var browseDir = require('./../file-settings').browseDir;
var multer = require('multer');

var storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, path.resolve('./uploads'));
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now());
  }
});
var upload = multer({ storage : storage }).array('uploadFiles',20);

module.exports = function(app)
{
  app.get('/', function (request, response, next) {
    response.redirect(request.baseUrl + '/browse');
  });
  app.use('/delete', function(req, res, next) {
    fs.unlink((req.originalUrl || '').replace(/.*delete/, browseDir), function(err) {
      if(err) {
        console.log(err);
        return res.status(500).end("Error deleting file.");
      }
      return res.status(200).end("Successfully deleted file");
    });
  });
  app.use('/upload', function(req, res, next) {
    upload(req,res,function(err) {
        var uploadDir = (req.originalUrl || '').replace(/.*upload/, browseDir);
        if(err) {
          console.log(err);
          return res.end("Error uploading file.");
        }
        for(var i=0;i<req.files.length;i++) {
          fs.move(path.join('./uploads',req.files[i].filename),path.join(uploadDir,req.files[i].originalname), function (err) {
            if (err) {
              console.log(req.files.length);
              fs.remove(err.path,function(err2){if(err2) console.log(err2);})
              return console.error(err);
            }
            console.log(req.files.length);
            console.log("success!")
          });
        }
        res.end("File is uploaded");
    });
  });
  app.use('/raw', function (request, response, next) {
    var unescapedPath = request.path.split('/').map(function (part) {
      return decodeURIComponent(part).replace(/\//g, '\\/');
    }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);
    if (!path.isAbsolute(fullPath)) {
      fullPath = path.join(process.cwd(), fullPath);
    }
    if (request.method === 'PUT') {
      var stream = fs.createWriteStream(fullPath, {flags: 'w', defaultEncoding: 'utf8', fd: null, mode: 0o666, autoClose: true});
      request.pipe(stream);
      stream.on('error', function (error) {
          return next(error);
      });
      stream.on('close', function () {
          response.json(true);
      });
    } else if (request.method === 'GET') {
      response.sendFile(fullPath);
    } else {
      next();
    }
  });
  app.use(['/preview', '/text'], function (request, response, next) {
    if (request.method !== 'GET') return next();
    var baseUrl = (request.baseUrl || '').replace(/\/(preview|text)$/, '');
    var stylePath = baseUrl + '/static';

    function urlForPath(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl + '/browse' + path;
    }
    function rawUrlForPath(path, type) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl + '/raw' + path + (type ? '?as=' + encodeURIComponent(type) : '');
    }

    var rawUrl = baseUrl + '/' + request.path;
    var unescapedPath = request.path.split('/').map(function (part) {
        return decodeURIComponent(part).replace(/\//g, '\\/');
    }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);

    if (/\/text$/.test(request.baseUrl)) {
        request.query.as = request.query.as || 'text/plain';
    } else {
        request.query.as = request.query.as;
    }
    var data = {
        mimeType: request.query.as,
        mimeGuess: mime.lookup(fullPath),
        name: path.basename(fullPath),
        path: relativePath,
        rawUrl: rawUrlForPath(relativePath, request.query.as),
        parent: relativePath.replace(/\/[^/]*$/, '') || '/'
    };
    data.parentUrl = urlForPath(data.parent);
    if (/\/text$/.test(request.baseUrl)) {
        fs.readFile(fullPath, {encoding: 'utf-8'}, function (error, text) {
            if (error) return next(error);
            response.render('text', {
                file: data,
                style: stylePath,
                text: text.replace(/\n/g, "\\n")
                          .replace(/\'/g, "\\'")
                          .replace(/\"/g, '\\"')
                          .replace(/\&/g, "\\&")
                          .replace(/\r/g, "\\r")
                          .replace(/\t/g, "\\t")
                          .replace(/\f/g, "\\f")
                          .replace(/[\u0000-\u0019]+/g,"")
            });
        });
    } else {
      response.render('preview',{
          file: data,
          style: stylePath
      });
    }
  });
	app.use('/browse', function (request, response, next) {
    function urlForPath(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl + path;
    }
    function previewUrlForPath(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl.replace(/\/browse\/?/, '/preview') + path;
    }
    function textUrlForPath(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl.replace(/\/browse\/?/, '/text') + path;
    }
    function rawUrlForPath(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl.replace(/\/browse\/?/, '/raw') + path;
    }
    function rawUrlForUpload(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl.replace(/\/browse\/?/, '/upload') + path;
    }
    function rawUrlForDelete(path) {
        path = path.split('/').map(function (part) {
            return encodeURIComponent(part.replace(/\\\//g, '/'));
        }).join('/');
        return baseUrl.replace(/\/browse\/?/, '/delete') + path;
    }
    if (request.method !== 'GET') return next();
    var baseUrl = (request.baseUrl || '');
    var stylePath = baseUrl.replace(/\/browse\/?$/, '/static');
    var unescapedPath = request.path.split('/').map(function (part) {
        return decodeURIComponent(part).replace(/\//g, '\\/');
    }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);
		fs.stat(fullPath, function (error, stats) {
			if (error) return next(error);
			if (stats.isDirectory()) {
				fs.readdir(fullPath, function (error, entries) {
					entries = entries.filter(function (a) {
						if (a === '.' || a === '..') return false;
            if ((options.hideDot && !request.query.hidden) && a[0] === '.') return false;
            return true;
					});
					async.map(entries, function (entry, callback) {
						var relativeEntry = path.join(relativePath, entry);
						var fullEntry = path.join(fullPath, entry);
						var extension = entry.replace(/.*\./, '');
						fs.stat(fullEntry, function (error, stats) {
							var mimeType = null, mimeCategory = null, mimeSubType = null;
							if (!stats.isDirectory()) {
								mimeType = mime.lookup(relativeEntry);
								mimeCategory = mimeType.replace(/\/.*/, '');
								mimeSubType = mimeType.replace(/.*\//, '').replace(/(;|\s).*/, '');
								if (options.textExtensions.indexOf(extension.toLowerCase()) !== -1) {
									mimeCategory = 'text';
								}
								for (var i = 0; i < options.textTypes.length; i++) {
									var type = options.textTypes[i];
									if (typeof type === 'string' && mimeType.substring(0, type.length) === type) {
										mimeCategory = 'text';
									} else if (type.test && type.test(mimeType)) {
										mimeCategory = 'text';
									}
								}
							}
							if (error) callback(error);
              var jsonData = {
								name: entry,
								path: relativeEntry,
								mimeType: mimeType,
								mimeCategory: mimeCategory || 'directory',
								mimeSubType: mimeSubType || 'directory',
								type: stats.isDirectory() ? 'directory' : 'file',
								size: stats.size,
								modified: stats.mtime.getTime()/1000,
								created: stats.ctime.getTime()/1000,
								mode: stats.mode
							};
              jsonData.rawUrl = rawUrlForPath(relativeEntry);
              if (jsonData.type === 'directory') {
                  jsonData.url = urlForPath(relativeEntry);
              } else if (jsonData.mimeCategory === 'text') {
                  jsonData.url = textUrlForPath(relativeEntry) + '?as=' + encodeURIComponent(jsonData.mimeType);
              } else if (jsonData.mimeCategory === 'image') {
                  jsonData.url = previewUrlForPath(relativeEntry);
              } else {
                  jsonData.url = rawUrlForPath(relativeEntry);
              }
							callback(null, jsonData);
						});
					}, function (error, dirListing) {
						if (error) return next(error);
						dirListing.sort(function (a, b) {
							if (a.type < b.type) return -1;
							if (a.type > b.type) return 1;
							return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
						})
						var dirData = {
							path: relativePath,
							name: path.basename(relativePath) || 'root',
							children: dirListing,
              rawUrl: rawUrlForPath(relativePath),
              uploadUrl: rawUrlForUpload(relativePath),
              deleteUrl: rawUrlForDelete(relativePath)
						};
            var parent = relativePath.replace(/\/[^/]*$/, '') || '/';
						dirData.parent = parent;
						dirData.parentUrl = (relativePath !== '/' || null) && urlForPath(parent);
						response.render('directory',{
							directory: dirData,
							style: stylePath
						});
					});
				});
			} else {
				response.json(stats);
			}
		});
	});
};
