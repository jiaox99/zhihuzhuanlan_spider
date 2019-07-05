const fs = require('fs');
const https = require('https');
const xmlBuilder = require('xmlbuilder');
const htmlparser = require('htmlparser2');
const { StringDecoder } = require('string_decoder');
const sa = require('superagent');
const crypto = require('crypto');

const decoder = new StringDecoder('utf8');
const root_dir = "./www/";
const init_url = "https://zhuanlan.zhihu.com/p/36675543";
const temp_file = "temp.json"

// var md5 = crypto.createHash("md5");
// md5.update("https://www.zhihu.com/equation?tex=S+%3D+C_%7BBaseColor%7D+%2B+S_%7BSpecular%7D");
// console.log(md5.digest("hex"));
// md5 = crypto.createHash("md5");
// md5.update("https://www.zhihu.com/equation?tex=S+%3D+C_%7BBaseColor%7D+%2B+S_%7BSpecular%7D");
// console.log(md5.digest("base64"));
// return;

sa.get("https://static.zhihu.com/heifetz/app.028e4754a9f8d13a4c5b.css")
    .end((err, res) => {
        console.log(err);
        console.log(res);
    });
return;

var files = fs.readdirSync("www");
for (var i=0; i<files.length; i++)
{
    var file = files[i];
    if (file.indexOf(".html") != -1)
    {

    }
}

return;

var urlArr = [];
var resArr = [];
var htmlDom = createHtmlDom();
var isBegin = false;
var isSkipCurNode = false;

function createHtmlDom() {
    return xmlBuilder.create("html", { headless: true }).dtd().root();
}

if (!fs.existsSync("./www")) {
    fs.mkdirSync("www/css", { recursive: true })
    fs.mkdirSync("www/js", { recursive: true })
    fs.mkdirSync("www/img", { recursive: true })
}

var parser = new htmlparser.Parser({
    onopentag: (name, attribs) => {
        // console.log("onopentag -----------------<" + name);
        // console.log(name, attribs);
        var lcName = name.toLowerCase();
        if (lcName == 'html') {
            htmlDom.att(attribs);
        }
        else if (lcName == 'head') {
            isBegin = true;
            htmlDom = htmlDom.ele(name);
            htmlDom.att(attribs);
        }
        else if (isBegin) {
            if (lcName == 'script') {
                if (attribs.crossorigin || attribs.id == "js-initialData" || attribs.id == "") {
                    isSkipCurNode = true;
                    return;
                }
            }
            else if (lcName == "noscript") {
                isSkipCurNode = true;
                return;
            }
            else if (lcName == "img" && attribs.src == "svg>")
            {
                isSkipCurNode = true;
                return;
            }
            htmlDom = htmlDom.ele(name);
            fixResPath(name, attribs);
            // console.log("After fix", attribs);
            htmlDom.att(attribs);
        }
    },
    ontext: (text) => {
        // console.log("ontext");
        // console.log(text);
        if (text && isBegin && !isSkipCurNode) {
            htmlDom.text(text);
        }
    },
    onprocessinginstruction: (name, data) => {
        // console.log("onprocessinginstruction");
        // console.log(name, data);
    },
    onclosetag: (tagname) => {
        // console.log("onclosetag");
        // console.log(tagname);
        if (isBegin && !htmlDom.isRoot && !isSkipCurNode) {
            // console.log(htmlDom.debugInfo());
            htmlDom = htmlDom.up();
        }
        isSkipCurNode = false;
    }
}, { decodeEntities: true });

function loadTemp() {
    var temp = JSON.parse(decoder.write(fs.readFileSync(temp_file)));
    urlArr = temp.urlArr;
    resArr = temp.resArr;
    fs.unlinkSync(temp_file);
}

function saveTemp() {
    if (resArr.length > 0 || urlArr.length > 0) {
        fs.writeFileSync(temp_file, JSON.stringify({ urlArr: urlArr, resArr: resArr }));
    }
    else if (fs.existsSync(temp_file)) {
        fs.unlinkSync(temp_file);
    }
}

if (fs.existsSync(temp_file)) {
    loadTemp();
    continueNext();
}
else {
    saveHtml(init_url);
}

function pushUrl(url) {
    if (url) {
        urlArr.push(url);
        saveTemp();
    }
}

function pushRes(url) {
    if (url) {
        resArr.push(url);
        saveTemp();
    }
}

function getMD5(url)
{
    var md5 = crypto.createHash("md5");
    return md5.digest("hex");
}

function fixResPath(tagName, attribs) {
    var lcName = tagName.toLowerCase();
    var url;
    if (lcName == 'a' && attribs.href) {
        url = attribs.href;
        if (url.indexOf("zhuanlan.zhihu.com") != -1) {
            var info = fixZhuanlanUrl(url);
            attribs.href = info.pName + ".html";
            pushUrl(info.url);
        }
    }
    else if ((lcName == 'script' || lcName == "img") && attribs.src) {
        url = attribs.src;
        attribs.src = (lcName == 'script' ? "js/" : "img/") + url;
    }
    else if (lcName == 'link' && attribs.href) {
        url = attribs.href;
        var ext = url.split(".").pop();
        if ( ext == "css")
        {
            attribs.href = "css/" + url;
        }
        else if (ext == ".com")
        {

        }
        else
        {
            attribs.href = "img/" + url;
        }
        pushRes(url);
    }
    else if (attribs.style && attribs.style.indexOf("http") != -1)
    {
        url = attribs.style;
        attribs.style = attribs.style.replace( /http.*com/, "img");
        url = url.substring(url.indexOf("(")+1, url.indexOf(")"));
        pushRes(url)
    }
}

function fixZhuanlanUrl(url) {
    var start = url.lastIndexOf("/") + 1;
    var end = url.indexOf("?");
    if (end == -1) {
        end = url.length;
    }
    var pName = url.substring(start, end)
    if (url == init_url)
    {
        pName = "index";
    }
    var info = { pName: pName, url: "https://zhuanlan.zhihu.com/p/" + pName };
    // console.log(info);
    return info;
}

function saveHtml(url, filePath) {
    console.log("Save html:" + url);
    var fileName = url == init_url ? "index.html" : url.substr(url.lastIndexOf("/")) + ".html";
    var htmlStr = "";
    var filePath = root_dir + fileName;
    if (fs.existsSync(filePath) || url.indexOf("#") != -1) {
        continueNext();
        return;
    }

    sa.get(url)
        .end((err, res) => {
            parser.parseComplete(res.text);
            fs.writeFileSync(filePath, htmlDom.end({ pretty: true, allowEmpty: true }));
            // fs.writeFileSync(root_dir + fileName, htmlStr);
            htmlDom = createHtmlDom();
            isBegin = false;

            continueNext();
        });
}

function continueNext() {

    // return;
    if (urlArr.length > 0) {
        var url = urlArr.pop();
        if (url) {
            saveTemp();
            saveHtml(url);
        }
        else {
            continueNext();
        }
    }
    else if (resArr.length > 0) {
        var res = resArr.pop();
        if (res) {
            saveTemp();
            downloadRes(res);
        }
        else {
            continueNext();
        }
    }
}

function validteUrl(url) {
    if (url.indexOf("<") != -1) {
        return false;
    }
    return true;
}

function downloadRes(url) {
    if (!validteUrl(url)) {
        continueNext();
        return;
    }
    console.log("Download res:" + url);
    var fileName = url.substr(url.lastIndexOf("/")+1);
    if (url.indexOf("equation") != -1)
    {
        fileName = getMD5(url) + ".svg";
    }
    var ext = fileName.split(".").pop();
    var subDir = (ext == "js" || ext == "css") ? ext : "img";
    var filePath = root_dir + subDir + "/" + fileName;
    if (fs.existsSync(filePath)) {
        continueNext();
        return;
    }

    sa.get(url)
        .end((err, res)=>{
            if (res && res.body)
            {
                if (ext == "svg")
                {
                    fs.writeFileSync(filePath, decoder.write(res.body));
                }
                else if (ext == 'css')
                {
                    fs.writeFileSync(filePath, res.text);
                }
                else{
                    fs.writeFileSync(filePath, res.body);
                }
            }
            
            continueNext();
        });
}