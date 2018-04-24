/**
* @providesModule react-native-link-preview
*/

const cheerio = require('cheerio-without-node-native');
const urlObj = require('url');
const { fetch } = require('cross-fetch');

const { REGEX_VALID_URL } = require('./constants');

exports.getPreview = function(text, options) {
  return new Promise((resolve, reject) => {
    if (!text) {
      reject({
        error: 'React-Native-Link-Preview did not receive either a url or text'
      });
    }

    let detectedUrl = null;

    text.split(' ').forEach(token => {
      if (REGEX_VALID_URL.test(token) && !detectedUrl) {
        detectedUrl = token;
      }
    });

    const headers = new Headers();
    headers.append('Accept', 'text/html');

    if (detectedUrl) {
      fetch(detectedUrl, { headers })
        .then(response => preParse(response, detectedUrl))
        .then(preParse => {
          if (preParse.url){
            resolve(preParse);
          } else {
            resolve(parseResponse(preParse, detectedUrl, options || {}));
          };
        }, (reason) => {
          reject({ error: 'React-Native-Preview-Link did not find a link in the text' });
        })
        .catch(error => {
          reject({ error });
        });
    } else {
      reject({
        error: 'React-Native-Preview-Link did not find a link in the text'
      });
    }
  });
};

const preParse = function (response, url) {
  return new Promise((resolve, reject) => {
    let r = null;
    try {
      response.headers.forEach(header => {
        if (header.startsWith('image/')) {
          r = { url, images: [url], title: '', description: '', videos: [], mediaType: header };
        }
      });
      if (r){
        resolve(r);
      } else if (!response._bodyInit){
        reject({ error: 'No links' });
      } else {
        response.text().then(text => resolve(text));
      }
    } catch (e) {
      reject({error: 'No data for this link'});
    }
  });
};

const parseResponse = function(body, url, options) {
  const doc = cheerio.load(body);

  return {
    url,
    title: getTitle(doc),
    description: getDescription(doc),
    mediaType: getMediaType(doc) || 'website',
    images: getImages(doc, url, options.imagesPropertyType),
    videos: getVideos(doc)
  };
};

const getTitle = function(doc) {
  let title = doc("meta[property='og:title']").attr('content');

  if (!title) {
    title = doc('title').text();
  }

  return title;
};

const getDescription = function(doc) {
  let description = doc('meta[name=description]').attr('content');

  if (description === undefined) {
    description = doc('meta[name=Description]').attr('content');
  }

  if (description === undefined) {
    description = doc("meta[property='og:description']").attr('content');
  }

  return description;
};

const getMediaType = function(doc) {
  const node = doc('meta[name=medium]');

  if (node.length) {
    const content = node.attr('content');
    return content === 'image' ? 'photo' : content;
  } else {
    return doc("meta[property='og:type']").attr('content');
  }
};

const getImages = function(doc, rootUrl, imagesPropertyType) {
  let images = [],
    nodes,
    src,
    dic;

  nodes = doc(`meta[property='${imagesPropertyType || 'og'}:image']`);

  if (nodes.length) {
    nodes.each((index, node) => {
      src = node.attribs.content;
      if (src) {
        src = urlObj.resolve(rootUrl, src);
        images.push(src);
      }
    });
  }

  if (images.length <= 0 && !imagesPropertyType) {
    src = doc('link[rel=image_src]').attr('href');
    if (src) {
      src = urlObj.resolve(rootUrl, src);
      images = [src];
    } else {
      nodes = doc('img');

      if (nodes.length) {
        dic = {};
        images = [];
        nodes.each((index, node) => {
          src = node.attribs.src;
          if (src && !dic[src]) {
            dic[src] = 1;
            // width = node.attribs.width;
            // height = node.attribs.height;
            images.push(urlObj.resolve(rootUrl, src));
          }
        });
      }
    }
  }

  return images;
};

const getVideos = function(doc) {
  const videos = [];
  let nodeTypes;
  let nodeSecureUrls;
  let nodeType;
  let nodeSecureUrl;
  let video;
  let videoType;
  let videoSecureUrl;
  let width;
  let height;
  let videoObj;
  let index;

  const nodes = doc("meta[property='og:video']");
  const length = nodes.length;

  if (length) {
    nodeTypes = doc("meta[property='og:video:type']");
    nodeSecureUrls = doc("meta[property='og:video:secure_url']");
    width = doc("meta[property='og:video:width']").attr('content');
    height = doc("meta[property='og:video:height']").attr('content');

    for (index = 0; index < length; index++) {
      video = nodes[index].attribs.content;

      nodeType = nodeTypes[index];
      videoType = nodeType ? nodeType.attribs.content : null;

      nodeSecureUrl = nodeSecureUrls[index];
      videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs.content : null;

      videoObj = {
        url: video,
        secureUrl: videoSecureUrl,
        type: videoType,
        width,
        height
      };
      if (videoType.indexOf('video/') === 0) {
        videos.splice(0, 0, videoObj);
      } else {
        videos.push(videoObj);
      }
    }
  }

  return videos;
};

// const parseMediaResponse = function(res, contentType, url) {
//   if (contentType.indexOf('image/') === 0) {
//     return createResponseData(url, false, '', '', contentType, 'photo', [url]);
//   } else {
//     return createResponseData(url, false, '', '', contentType);
//   }
// }
