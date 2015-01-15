var fs         = require("fs");
var path       = require("path");
var async      = require("async");
var directives = require("./directive-stripper");

var pluginTmpl = fs.readFileSync(__dirname + "/templates/plugin.tmpl", "utf-8");
var configTmpl = fs.readFileSync(__dirname + "/templates/config.tmpl", "utf-8");
var configItem = fs.readFileSync(__dirname + "/templates/config.item.tmpl", "utf-8");
var inlineTemp = fs.readFileSync(__dirname + "/templates/inline.template.tmpl", "utf-8");

function createTemplate(cp, item) {
    return item;
}
/**
 //*
 * @type {{markup: Function, client:js: Function, templates: Function}}
 */
module.exports = {
    /**
     * Create the url config for each section of the ui
     * @param hooks
     * @param cb
     */
    "page": function (hooks, cp, cb) {

        var config = hooks
            .map(transformConfig)
            .map(createTemplate.bind(null, cp))
            .reduce(createConfigItem, {});

        preAngular(cp.pluginManager.plugins, config, function (err, markup) {

            return cb(null, {
                /**
                 * pagesConfig - This is the angular configuration such as routes
                 */
                pagesConfig: configTmpl
                    .replace("%when%", hooks.reduce(
                        createAngularRoutes,
                        ""
                    ))
                    .replace("%pages%", JSON.stringify(
                        config,
                        null,
                        4
                    )),
                /**
                 * pagesConfig in object form
                 */
                pagesObj: config,
                pageMarkup: markup
            });
        });

    },
    /**
     * Controller markup for each plugin
     * @param hooks
     * @returns {*}
     */
    "markup": function (hooks, config, plugins) {

        return hooks
            .reduce(function (combined, item) {
                return [combined, pluginTmpl.replace("%markup%", item)].join("\n");
            }, "");
    },
    "client:js": function (hooks) {
        return hooks.join(";");
    },
    "templates": function (hooks) {
        return createInlineTemplates(hooks);
    }
};

/**
 *
 */
function createInlineTemplates (hooks) {

    var out = hooks.reduce(function (combined, item) {

        var string = "";
        item.forEach(function (filepath) {
            var filecontents;
            try {
                filecontents = fs.readFileSync(filepath);
                filepath     = path.basename(filepath);
                string += inlineTemp.replace("%id%", filepath).replace("%content%", filecontents);
            } catch (e) {
                throw e;
            }
        });
        return combined += string;
    }, "");

    return out;
}

function getIcon () {

}

/**
 * @param item
 * @returns {*}
 */
function transformConfig (item) {
    return item;
}

/**
 * @param {String} all
 * @param {Object} item
 * @returns {*}
 */
function createAngularRoutes(all, item) {
    return all + configItem.replace(/%(.+)%/g, function () {
        var key = arguments[1];
        if (item[key]) {
            return item[key];
        }
    });
}

/**
 * @param joined
 * @param item
 * @returns {*}
 */
function createConfigItem (joined, item) {
    if (item.path === "/") {
        joined["server-info"] = item;
    } else {
        joined[item.path.slice(1)] = item;
    }
    return joined;
}

/**
 * @returns {*}
 */
function pluginTemplate (combined, item) {
    return [combined, pluginTmpl.replace("%markup%", item)].join("\n");
}


/**
 *
 */
function preAngular (plugins, config, cb) {

    var out = "";

    async.eachSeries(Object.keys(plugins), function (key, done) {

        var boundOnce = bindOnce(plugins[key].hooks.markup, config[key]);

        directives.directiveStripper("icon", boundOnce, config[key], function (err, out2) {

            // Make a <script> template
            out += inlineTemp
                .replace("%content%", out2)
                .replace("%id%", config[key].template);

            done();
        });
    }, function (err) {
        cb(null, out);
    });
}

/**
 * @param markup
 * @param config
 * @returns {*}
 */
function bindOnce (markup, config) {

    return markup.toString().replace(/\{\{section\.(.+?)\}\}/g, function ($1, $2) {
        return config[$2] || "";
    });
}

