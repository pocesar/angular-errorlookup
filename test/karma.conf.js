module.exports = function (config){
  config.set({
    basePath      : '../',

    frameworks    : ['mocha'],

    files         : [
			'bower_components/angular/angular.js',
			'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/expect/index.js',
      'test/test.js'
    ],

    exclude       : [],

    proxies       : {},

    reporters     : ['progress'],

    port          : 9876,

    colors        : true,

    logLevel      : config.LOG_INFO,

    autoWatch     : false,

    browsers      : ['Firefox'],

    captureTimeout: 60000,

    singleRun     : true
  });
};
