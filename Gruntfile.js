// Generated on 2013-03-31 using generator-webapp 0.1.5
'use strict';

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    // var YAML = require('yamljs');
    // var yaml = require('js-yaml');

    var newsletterDir   = 'content/';
    var templateDir     = 'templates/';
    var outputDir       = 'output/';
    var configFile      = templateDir + 'config.json';

    ////////////////////////////////////////////////////////////////////////

    // var newsletterYaml = newsletterDir + 'ew-issue-z144-[2016-01-31].yaml';

    ////////////////////////////////////////////////////////////////////////

    grunt.initConfig({
        watch: {
            news: {
                files: [newsletterDir + '/**/*.{yaml,handlebars}'],
                tasks: ['news']
            }
        }
    });

    // grunt.renameTask('regarde', 'watch');


    grunt.registerTask('new', function (issueNum) {
        var moment = require('moment');
        var templatePath = templateDir + 'template.yaml';

        var today = new Date();
        var date = moment().format('YYYY-MM-DD');

        if (!issueNum){
            if (!grunt.option.issueNum){
                grunt.fail.fatal('\nNo issue number passed!\n [][]' + grunt.option.issueNum);
            }else{
                grunt.option.issueNum++;
            }
        }else{
            grunt.option.issueNum = issueNum;
        }

        var newFilename = 'ew-issue-z' + grunt.option.issueNum + '-[' + date + '].yaml';
        var destinationPath = newsletterDir + newFilename;

        var configFileJson = grunt.file.readJSON(configFile);
        configFileJson.currentIssueFilename = newFilename;
        grunt.file.write(configFile, JSON.stringify(configFileJson));

        grunt.log.write('\ncreating new issue at ' + destinationPath + '...\n');

        grunt.file.copy(templatePath, destinationPath);

        // var newIssueYaml = grunt.file.readYAML(destinationPath);
        // grunt.log.write('\nwriting issue number ' + grunt.option.issueNum + ' to ' + newFilename + '...\n');
        // newIssueYaml.issue = grunt.option.issueNum;
        // grunt.file.write(destinationPath, yaml.dump(newIssueYaml));
    });

    //TODO: This is soooooo bad! Don't look at it!
    grunt.registerTask('news', function (arg1) {
        var Handlebars = require('handlebars');
        var Showdown = require('showdown');
        var URL = require('url');
        var validator = require('validator');
        var httpcheck = require('httpcheck')
        var RSVP = require('rsvp');

        var markdownConverter = new Showdown.converter();

        var templatePath = arg1 === 'text' ? templateDir + 'text-template.handlebars' : templateDir + 'template.handlebars';
        var content = {};
        var template = '';

        var configFileJson = grunt.file.readJSON(configFile);
        var newsletterYaml = newsletterDir + configFileJson.currentIssueFilename;

        if (!newsletterYaml && !grunt.file.exists(newsletterYaml)) {
            grunt.log.error('error - no yaml file at ' + newsletterYaml);
            return;
        }

        content = grunt.file.readYAML(newsletterYaml);

        grunt.log.write('yaml - ', content);

        if (templatePath && grunt.file.exists(templatePath)){
            template = grunt.file.read(templatePath);
        }else{
            grunt.log.error('error - no template at ' + templatePath);
        }

        if (!template){
            grunt.log.error('no template found');
            return;
        }

        var convertToHTML = function(description){
            if (description){
                var desc = markdownConverter.makeHtml(description);
                //very naive way to remove paragragh tag added by showdown
                if (desc){
                    desc = desc.substring(3, desc.length);
                    desc = desc.substring(0, desc.length - 4);
                    return new Handlebars.SafeString(desc);
                }
            }
            return '';
        };

        content.content.forEach(function(section){
            section.descriptionHTML = convertToHTML(section.description);
            if (section.headlines){
                section.headlines.forEach(function(headline){
                    headline.descriptionHTML = convertToHTML(headline.description);

                    try{
                        validator.isURL(headline.link);
                    }catch(e){
                        if (headline.link.indexOf('mailto:') !== -1){
                            grunt.log.warn('Double check that the following mailto is vailid', headline.link);
                        }else {
                            grunt.log.error('\nInvalid url for "' + headline.link + '" in headline', headline);
                            throw e;
                        }
                    }

                    headline.domain = headline.domain || URL.parse(headline.link).hostname.replace('www.', '');
                });
            }
        });

        var done = this.async();

        var allPromise = [];
        var validateURL = true;

        //Check for URL 404
        if (validateURL){
            content.content.forEach(function(section){
                if (section.headlines){
                    section.headlines.forEach(function(headline){
                        var promise = new RSVP.Promise(function(resolve, reject) {
                            httpcheck({
                                url: headline.link,
                                log: grunt.log.debug,
                                checkTries:3,
                                check: function(res) {
                                    if (res && res.statusCode !== 404) {
                                        return true;
                                    }
                                    grunt.log.warn('HTTP check Failed ' + res.statusCode + ' for url "' + headline.link + '"');
                                    return false;
                                }
                            }, function(err) {
                                if (err) {
                                    reject(err);
                                }
                                resolve(headline.link);
                            });
                        });

                        promise.then(function(link) {
                            grunt.log.debug('HTTP check for "' + link + '" passed!');
                        }, function(link) {
                            grunt.log.error('HTTP check for "' + link + '" failed!');
                        });
                        allPromise.push(promise);
                    });
                }
            });
        }

        var html = Handlebars.compile(template)(content);
        var extension = arg1 === 'text' ? '.txt' : '.html';

        var outputFileName = 'ew-issue-' + content.issue + extension;
        grunt.log.write('\nwriting ' + outputFileName + '...\n');
        grunt.file.write(outputDir + outputFileName, html);

        RSVP.all(allPromise).then(function() {
            grunt.log.write('\nFinished Validating!\n');
            done();
        });
    });
};
