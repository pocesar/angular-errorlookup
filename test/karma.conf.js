module.exports = function (config){
  config.set({
    basePath      : '../',

    frameworks    : ['mocha'],

    files         : [
      'bower_components/chai/chai.js',
      'bower_components/jquery/dist/jquery.js',
      'bower_components/lodash/lodash.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'angular-errorlookup.js',
      'test/test.js'
    ],

    exclude       : [],

    proxies       : {},

    reporters     : ['spec'],

    port          : 9876,

    colors        : true,

    logLevel      : config.LOG_INFO,

    autoWatch     : false,

    browsers      : ['Firefox'],

    captureTimeout: 60000,

    singleRun     : true
  });
};
