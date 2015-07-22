var gulp                = require('gulp');
var browserSync         = require('browser-sync').create();
var del                 = require('del');
var plugins             = require('gulp-load-plugins')();
var bowerFiles          = require('main-bower-files');
var Q                   = require('q');
var es                  = require('event-stream');

var _gulpsrc = gulp.src;
gulp.src = function() {
    return _gulpsrc.apply(gulp, arguments)
    .pipe(plugins.plumber({
        errorHandler: function(err) {
            plugins.notify.onError({
                title:    "Gulp Error",
                message:  "Error: <%= error.message %>",
                sound:    "Bottle"
            })(err);
            this.emit('end');
        }
    }));
};

// == PATH STRINGS ========

var paths = {
    // all the js in app folder
    scripts: './app/**/*.js',

    // all the js that need to be concated in dist build for angular
    concatScripts: './app/scripts/**/*.js',

    otherScripts: './app/*.js',

    styles: 'app/styles/**/*.scss',

    appSassFile: 'app/styles/main.scss',
    landingSassFile: 'app/styles/landing.scss',

    images: './public/img/**/*',
    spriteImg: './app/sprites/*.png',
    sprites: './app/scripts/sprites.scss',
    index: ['./app/index.html', './app/video.html'],
    partials: ['./app/partials/*.html'],

    // == Finished build dirs
    distDev: './dist.dev',
    distProd: './dist.prod',
    distScriptsProd: './dist.prod/scripts',
    scriptsDevServer: 'devServer/**/*.js'
};

// == PIPE SEGMENTS ========

var pipes = {};

pipes.spriteData = function () {
    return gulp.src(paths.spriteImg)
        .pipe(plugins.spritesmith({
            imgName: 'spritesheet.png',
            cssName: 'sprites.scss'
        }))
        .pipe(gulp.dest(paths.distDev));
};

pipes.orderedVendorScripts = function() {
    return plugins.order(['jquery.js', 'angular.js']);
};

pipes.orderedAppScripts = function() {
    return plugins.angularFilesort();
};

pipes.minifiedFileName = function() {
    return plugins.rename(function (path) {
        path.extname = '.min' + path.extname;
    });
};

pipes.validatedAppScripts = function() {
    return gulp.src(paths.concatScripts)
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'));
};

pipes.validatedOtherScripts = function() {
    return gulp.src(paths.otherScripts)
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'));
};

pipes.builtAppScriptsDev = function() {
    return pipes.validatedAppScripts()
        .pipe(gulp.dest(paths.distDev + '/scripts'));
};

pipes.builtOtherScriptsDev = function() {
    return pipes.validatedOtherScripts()
        .pipe(gulp.dest(paths.distDev));
}

pipes.builtAppScriptsProd = function() {
    var scriptedPartials = pipes.scriptedPartials();
    var validatedAppScripts = pipes.validatedAppScripts();

    return es.merge(scriptedPartials, validatedAppScripts)
        .pipe(pipes.orderedAppScripts())
        .pipe(plugins.sourcemaps.init())
            .pipe(plugins.concat('app.min.js'))
            .pipe(plugins.uglify())
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest(paths.distScriptsProd));
};

pipes.builtVendorScriptsDev = function() {
    return gulp.src(bowerFiles())
        .pipe(gulp.dest('dist.dev/bower_components'));
};

pipes.builtVendorScriptsProd = function() {
    return gulp.src(bowerFiles())
        .pipe(pipes.orderedVendorScripts())
        .pipe(plugins.concat('vendor.min.js'))
        .pipe(plugins.uglify())
        .pipe(gulp.dest(paths.distScriptsProd));
};

pipes.validatedDevServerScripts = function() {
    return gulp.src(paths.scriptsDevServer)
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'));
};

pipes.validatedPartials = function() {
    return gulp.src(paths.partials)
        .pipe(plugins.htmlhint({'doctype-first': false}))
        .pipe(plugins.htmlhint.reporter());
};

pipes.builtPartialsDev = function() {
    return pipes.validatedPartials()
        .pipe(gulp.dest(paths.distDev));
};

pipes.scriptedPartials = function() {
    return pipes.validatedPartials()
        .pipe(plugins.htmlhint.failReporter())
        .pipe(plugins.htmlmin({collapseWhitespace: true, removeComments: true}))
        .pipe(plugins.ngHtml2js({
            moduleName: "healthyGulpAngularApp"
        }));
};

pipes.builtAppStylesDev = function() {
    return gulp.src(paths.appSassFile)
        .pipe(plugins.sass({
            includePaths: ['.' , 'bower_components/foundation/scss']
        }))
        .pipe(gulp.dest(paths.distDev));
};

pipes.builtLandingStylesDev = function() {
    return gulp.src(paths.landingSassFile)
        .pipe(plugins.sass({
            includePaths: ['.' , 'bower_components/foundation/scss']
        }))
        .pipe(gulp.dest(paths.distDev));
}

pipes.builtAppStylesProd = function() {
    return gulp.src(paths.appSassFile)
        .pipe(plugins.sourcemaps.init())
            .pipe(plugins.sass({
                includePaths: ['.' , 'bower_components/foundation/scss']
            }))
            .pipe(plugins.minifyCss())
        .pipe(plugins.sourcemaps.write())
        .pipe(pipes.minifiedFileName())
        .pipe(gulp.dest(paths.distProd));
};

pipes.builtLandingStylesProd = function() {
    return gulp.src(paths.landingSassFile)
        .pipe(plugins.sourcemaps.init())
            .pipe(plugins.sass())
            .pipe(plugins.minifyCss())
        .pipe(plugins.sourcemaps.write())
        .pipe(pipes.minifiedFileName())
        .pipe(gulp.dest(paths.distProd));
};

pipes.processedImagesDev = function() {
    return gulp.src(paths.images)
        .pipe(gulp.dest(paths.distDev + '/images/'));
};

pipes.processedImagesProd = function() {
    return gulp.src(paths.images)
        .pipe(gulp.dest(paths.distProd + '/images/'));
};

pipes.validatedIndex = function() {
    return gulp.src(paths.index)
        .pipe(plugins.htmlhint())
        .pipe(plugins.htmlhint.reporter());
};

pipes.builtIndexDev = function() {

    var orderedVendorScripts = pipes.builtVendorScriptsDev()
        .pipe(pipes.orderedVendorScripts());

    var orderedAppScripts = pipes.builtAppScriptsDev()
        .pipe(pipes.orderedAppScripts());

    var appStyles = pipes.builtAppStylesDev();

    return pipes.validatedIndex()
        .pipe(gulp.dest(paths.distDev)) // write first to get relative path for inject
        .pipe(plugins.inject(orderedVendorScripts, {relative: true, name: 'bower'}))
        .pipe(plugins.inject(orderedAppScripts, {relative: true}))
        .pipe(plugins.inject(appStyles, {relative: true}))
        .pipe(gulp.dest(paths.distDev));
};

pipes.builtIndexProd = function() {

    var vendorScripts = pipes.builtVendorScriptsProd();
    var appScripts = pipes.builtAppScriptsProd();
    var appStyles = pipes.builtAppStylesProd();

    return pipes.validatedIndex()
        .pipe(gulp.dest(paths.distProd)) // write first to get relative path for inject
        .pipe(plugins.inject(vendorScripts, {relative: true, name: 'bower'}))
        .pipe(plugins.inject(appScripts, {relative: true}))
        .pipe(plugins.inject(appStyles, {relative: true}))
        .pipe(plugins.htmlmin({collapseWhitespace: true, removeComments: true}))
        .pipe(gulp.dest(paths.distProd));
};

pipes.builtAppDev = function() {
    process.env.NODE_ENV = "development";

    return es.merge(pipes.builtIndexDev(),
        pipes.builtLandingStylesDev(),
        pipes.builtOtherScriptsDev(),
        pipes.builtPartialsDev(),
        pipes.processedImagesDev(),
        pipes.spriteData());
};

pipes.builtAppProd = function() {
    process.env.NODE_ENV = "production";

    return es.merge(pipes.builtIndexProd(), pipes.processedImagesProd());
};

// == TASKS ========

// removes all compiled dev files
gulp.task('clean-dev', function() {
    var deferred = Q.defer();
    del(paths.distDev, function() {
        deferred.resolve();
    });
    return deferred.promise;
});

// removes all compiled production files
gulp.task('clean-prod', function() {
    var deferred = Q.defer();
    del(paths.distProd, function() {
        deferred.resolve();
    });
    return deferred.promise;
});

// checks html source files for syntax errors
gulp.task('validate-partials', pipes.validatedPartials);

// checks index.html for syntax errors
gulp.task('validate-index', pipes.validatedIndex);

// moves html source files into the dev environment
gulp.task('build-partials-dev', pipes.builtPartialsDev);

// converts partials to javascript using html2js
gulp.task('convert-partials-to-js', pipes.scriptedPartials);

// runs jshint on the dev server scripts
gulp.task('validate-devserver-scripts', pipes.validatedDevServerScripts);

// runs jshint on the app scripts
gulp.task('validate-app-scripts', pipes.validatedAppScripts);

// moves app scripts into the dev environment
gulp.task('build-app-scripts-dev', pipes.builtAppScriptsDev);

// concatenates, uglifies, and moves app scripts and partials into the prod environment
gulp.task('build-app-scripts-prod', pipes.builtAppScriptsProd);

// compiles app sass and moves to the dev environment
gulp.task('build-styles-dev', pipes.builtAppStylesDev);

// compiles landing sass and moves to the dev environment
gulp.task('build-landing-styles-dev', pipes.builtLandingStylesDev);

// compiles and minifies app sass to css and moves to the prod environment
gulp.task('build-styles-prod', pipes.builtAppStylesProd);

// compiles app sprite sass and moves to dev environment
gulp.task('build-sprites-dev', pipes.spriteData);

// moves vendor scripts into the dev environment
gulp.task('build-vendor-scripts-dev', pipes.builtVendorScriptsDev);

// concatenates, uglifies, and moves vendor scripts into the prod environment
gulp.task('build-vendor-scripts-prod', pipes.builtVendorScriptsProd);

// validates and injects sources into index.html and moves it to the dev environment
gulp.task('build-index-dev', pipes.builtIndexDev);

// validates and injects sources into index.html, minifies and moves it to the dev environment
gulp.task('build-index-prod', pipes.builtIndexProd);

// builds a complete dev environment
gulp.task('build-app-dev', pipes.builtAppDev);

// builds a complete prod environment
gulp.task('build-app-prod', pipes.builtAppProd);

// cleans and builds a complete dev environment
gulp.task('clean-build-app-dev', ['clean-dev'], pipes.builtAppDev);

// cleans and builds a complete prod environment
gulp.task('clean-build-app-prod', ['clean-prod'], pipes.builtAppProd);

// clean, build, and watch live changes to the dev environment
gulp.task('watch-dev', ['clean-build-app-dev', 'validate-devserver-scripts'], function() {

    browserSync.init(['./dist.dev/**/*.*', './dist.dev/*.css'],{
        ui: {
            port: 8080
        },
        port: 8000,
        notify: false,
        reloadDebounce: 1500,
        server: {
            baseDir: './',
            routes: {
                "/": "dist.dev",
                "/public": "public"
            }
        }
    });

    // watch index
    gulp.watch(paths.index, function() {
        console.log('Change found! Rebuilding HTML')
        return pipes.builtIndexDev();
    });

    // watch app scripts
    gulp.watch(paths.scripts, function() {
        console.log('Change found! Rebuilding JS')
        return pipes.builtAppScriptsDev();
    });

    // watch html partials
    gulp.watch(paths.partials, function() {
        console.log('Change found! Rebuilding Partials')
        return pipes.builtPartialsDev();
    });

    // watch styles
    gulp.watch(paths.styles, function() {
        console.log('Change found! Rebuilding Sass')
        return pipes.builtAppStylesDev();
    });

});

// clean, build, and watch live changes to the prod environment
gulp.task('watch-prod', ['clean-build-app-prod', 'validate-devserver-scripts'], function() {

    // start nodemon to auto-reload the dev server
    // plugins.nodemon({ script: 'server.js', ext: 'js', watch: ['devServer/'], env: {NODE_ENV : 'production'} })
    //     .on('change', ['validate-devserver-scripts'])
    //     .on('restart', function () {
    //         console.log('[nodemon] restarted dev server');
    //     });

    // start live-reload server
    // plugins.livereload.listen({start: true});

    // watch index
    gulp.watch(paths.index, function() {
        return pipes.builtIndexProd()
            .pipe(reload);
    });

    // watch app scripts
    gulp.watch(paths.scripts, function() {
        return pipes.builtAppScriptsProd()
            .pipe(reload);
    });

    // watch hhtml partials
    gulp.watch(paths.partials, function() {
        return pipes.builtAppScriptsProd()
            .pipe(reload);
    });

    // watch styles
    gulp.watch(paths.styles, function() {
        return pipes.builtAppStylesProd()
            .pipe(reload);
    });

});

// default task builds for prod
gulp.task('default', ['clean-build-app-prod']);