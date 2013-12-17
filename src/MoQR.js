/**
 * Copyright (C) 2013 momomo.com <opensource@momomo.com>
 *
 * Licensed under the GNU LESSER GENERAL PUBLIC LICENSE, Version 3, 29 June 2007;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/lgpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @Author Mohamed Seifeddine
 * @Author Philip Nilsson
 */
(function() {
        callback();

        // Follows the pattern of other MoJS library definitions
        function callback() {
                var MoJS = window.MoJS || (window.MoJS = {});

                MoJS.require = MoJS.MoQR = require;
                MoJS.define  = define;

                window.require || (window.require = require);
                window.define  || (window.define  = define );
        }

        var that         = require;
        that.isMoQR      = true   ;
        that.library     = "MoQR" ;

        that.require     = require;
        that.define      = define ;

        that.jsonp       = jsonpResponse;
        that.clear       = clear;
        that.loadText    = loadText;
        that.pluginSplit = pluginSplit;

        var types = {
                script : "script",
                text   : "text",
                jsonp  : "jsonp"
        };

        var optionsGlobal = that.options = {
                isProduction                : false,

                path : {
                        app : {
                                root        : "",
                                plugins     : ""
                        }
                },

                dependencies                : {},
                collections                 : {},

                charDependency              : "|",
                charKey                     : "->",  // "::", "->", "==>
                charCollectionsLeft         : "{",
                charCollectionsRight        : "}",

                collectionsEnabled          : true,

                circularOnreadyRequired     : true,  // false => I know what I am doing, not invoking code
                circularEnabled             : false,  // Likely slower, default should be false

                // TODO Optimize merging
                defaults : {
                        path                : undefined,       // Always required by user
                        type                : types.script,
                        cache               : true,
                        circularEnabled     : false,
                        args                : false,
                        plugin              : undefined,

                        elementAsync        : undefined,
                        elementDefer        : undefined,
                        elementBeforeAppend : undefined,
                        elementAppendTo     : undefined
                }
        };


        var stackArray           = $Stack();  // Per script
        var scriptLoading        = 0;
        var cache                = {};

        var jsonpCallback        = "callback=MoJS.MoQR.jsonp";
        var elementId            = "MoQR";
        var elementBootstrapAttr = "bootstrap";
        var elementDataMainAttr  = "data-main";
        var elementRootAttr      = "root";



        // ======================================= Constructor =====================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


        (function constructor() {
                var element = document.getElementById(elementId);

                if ( element ) {
                        var root = element.getAttribute(elementRootAttr);
                        if ( root ) {
                                optionsGlobal.path.app.root = root;
                        }

                        var boostrap = element.getAttribute(elementBootstrapAttr);
                        if ( !boostrap ) {
                                element.getAttribute(elementDataMainAttr);      // Support for require
                        }

                        if ( boostrap ) {
                                loadResource( getAbsolutePath(boostrap) , optionsGlobal.defaults );
                        }

                }
        })();

        // ======================================= Core ============================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        /**
         * Basically we let all calls come in here first, register their keys as promises.
         * Then we go through them again once file has loaded, and child promises should all be there
         *
         * TODO Allow for the return of a promise if possible
         */
        function define() {
                if ( isString( arguments[0]) ) {
                        // All define calls end up here sooner or later either directly or through
                        // We stack the base call here as well, so first here, then base

                        // Register this key and its promise in advance, incase someone wants to load it
                        promiseCacheGetOrCreateDefine(arguments[0], 3);

                        // Invoke later when stack isProcessing
                        stackPush(defineToBase, arguments);
                }
                else if ( scriptLoading ) {
                        // Push to stack so it can pick the name for the define, next call define again, will end up in the first if block
                        stackPush(define, arguments);
                } else {
                        exceptionThrow("You must name this define statement! It appears as if this define call is not made from a script file. " +
                                "See log error id: " + exceptionLog(arguments));
                }
        }

        /**
         * TODO Allow for the return of a promise if possible
         */
        function require() {
                if ( isArray( arguments[0] ) ) {
                        // Key as undefined instead
                        Array.prototype.unshift.call( arguments, undefined);
                }

                // First argument is require
//                Array.prototype.unshift.call( arguments, require );

                // If loading a script, then push the next call to stack so it is invoked after the script has finished
                // Will allow all define statements to be picked up and registered first.
                // If not loading any scripts then we are not waiting for anything to become defined neither in this current script
                if ( scriptLoading ) {
                        stackPush(requireToBase, arguments);
                }
                else {
                        requireToBase.apply(that, arguments)
                }
        }

        function defineToBase(path, dependencies, callback, options) {
                var promiseParent = promiseCacheGetOrCreateDefine(path, undefined);

                if ( promiseParent.status == 2 ) {
                        exceptionThrow("Already have called defined once for : " + path);
                }

                return base(promiseParent, path, dependencies, callback, options);
        }

        function requireToBase(path, dependencies, callback, options) {
                var promiseParent;

                // Our path here is really just a cache key to hold on to this result
                if ( path ) {
                        promiseParent = promiseCacheGetOrCreateBase(path, undefined);

                        if ( promiseParent.status == 2 ) {
                                promiseParent.done(callback);
                                return;
                        }
                }
                else {
                        promiseParent = promiseCreateBasic(); // Nobody can depend on this, and no path
                }

                return base(promiseParent, path, dependencies, callback, options);
        }

        /**
         * Try to keep logic here, even though some pieces might be possible to lift out to define and requrire,
         * it provides a good entry point as to what goes on
         */
        function base(promiseParent, path, dependencies, callback, options) {
                promiseSetProperties (promiseParent, dependencies, callback, options);
                loadDependencies(promiseParent);
                return promiseParent;
        }

        /**
         * Manages the jsonp response
         */
        function jsonpResponse() {
                if ( scriptLoading && arguments.length < 2 ) {
                        stackPush(jsonpResponse, arguments);
                }
                else {
                        cache[ arguments[0] ].returns = arguments[1];  // The key will be on arguments[0] and the jsonp object on 2
                }
        }

        function clear(path) {
                if ( path ) {
                        cache[path] = undefined;  // faster than delete cache[key];
                }
                else {
                        // cache = {}; Should be more comprehensive than just resetting the cache, options?
                }
                return that;
        }



















        // =================================== Dependency management ===============================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        function loadDependencies(promiseParent) {
                promiseLock(promiseParent);
                loadDependenciesRecurse(promiseParent, promiseParent.dependencies);
                promiseUnlockResolveTry(promiseParent);
        }


        function loadDependenciesRecurse(promiseParent, dependencies) {
                if ( isArray(dependencies) ) {
                        // Allows for modification of the array while iterating
                        var index = 0;
                        while ( index < dependencies.length ) {
                                loadDependenciesRecurseAtIndex(promiseParent, dependencies, index++);
                        }
                } else {
                        for ( var key in dependencies ) {
                                loadDependenciesRecurseAtIndex(promiseParent, dependencies, key);
                        }
                }
        }

        function loadDependenciesRecurseAtIndex(promiseParent, dependencies, index) {
                if ( isArray(dependencies[index]) ) {
                        loadDependenciesRecurse(promiseParent, dependencies[index] )
                }
                else {
                        loadDependency(promiseParent, dependencies, index);
                }
        }

        function loadDependency(promiseParent, dependencies, index) {
                var optionsD = optionsDependencyGenerate(promiseParent, dependencies, index);
                if ( optionsD == -1 ) {
                        // Redo as the depencies have been modified
                        loadDependenciesRecurseAtIndex(promiseParent, dependencies, index);
                        return;
                }

                var promiseChild;
                if ( true || optionsD.cache == true ) {
                        promiseChild = promiseCacheGetOrCreateDefine (optionsD.path, 0);
                }
                else {
                        // TODO Do not refresh entire promise, only reset some stuff.
                        // TODO Also make sure that it enforces hard cache via random key appended to the path, questionmark??
                        promiseChild = promiseCreateDefine(optionsD.path, 0);
                }

                if ( optionsD.plugin ) {
                        promisePluginSet(promiseChild, optionsD.plugin);
                }

                // Who is trying to load you child?
                if ( promiseParent.path ) {
                        promiseChild .dependants [promiseParent.path] = true;
                        promiseParent.dependsOn  [promiseChild.path]  = true;
                }

                var circularEnd;
                // Circular dependency check and was not just created in the cache if block above
                if ( promiseParent.path && promiseChild.status == 2  && ( optionsGlobal.circularEnabled || optionsD.circularEnabled ) && ( circularEnd = dependsOn(promiseChild.path, promiseParent.path)) )  {
                        promiseCircularHandle (promiseParent, promiseChild, circularEnd, optionsD);
                }

                // Already been processed
                else if ( promiseChild.status ) {
                        promiseLock(promiseParent);
                        promiseParentSetKeyUnlockResolveTryWhenChildDone(promiseParent, promiseChild, optionsD);
                }

                else {
                        promiseChild.status = 1;

                        promiseLock(promiseChild);
                        promiseLock(promiseParent);
                        promiseParentSetKeyUnlockResolveTryWhenChildDone(promiseParent, promiseChild, optionsD);

                        loadResource(optionsD.path, optionsD, promiseChild)
                }

        }

        function loadResource(path, optionsD, promiseChild) {
                if (optionsD.type == types.text ) {
                        loadText(
                                path,

                                function(file, text) {

                                        promiseChild.lock--;
                                        if ( promiseChild.lock == 0 && !promiseChild.isResolved ) {
                                                promiseChild.returns = text;
                                                promiseResolve(promiseChild, promiseChild);
                                        }

                                },

                                function() {
                                        exceptionThrow("Failed to load file with path: " + path);
                                },
                                optionsD);
                }
                else {
                        scriptLoading++;
                        loadScript(
                                path,

                                function() {
                                        scriptLoading--;

                                        // A define or require call was made within the script
                                        if ( !stackIsEmpty() )  {
                                                stackProcess(path);
                                        }

                                        // Define or require was never called whithin that script.
                                        // was a global library that needs auto shimming

                                        else if ( promiseChild ) {
                                                promiseChild.autoshim = true;  // Will be read when resolved
                                        }

                                        // Null from constructor
                                        if ( promiseChild ) {
                                                promiseUnlockResolveTry (promiseChild);
                                        }


                                },

                                function() {
                                        scriptLoading--;

                                        exceptionThrow("Failed to load file with path: " + path);
                                },
                                optionsD);
                }
        }


























        // ============================== Options for dependency management ========================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        // TODO Can definetely be optimized futher, mergeLeft or mergeRight instead
        function optionsDependencyGenerate(promiseParent, dependencies, index) {
                var optionsD = dependencies[index];

                if ( isString(optionsD) ) {
                        optionsD = {
                                path : optionsD
                        };
                } else {
                        optionsD = merge({}, optionsD);
                }

                // === Options is now an object literal for sure ===

                if ( isArray(dependencies) ) {

                        if (
                                // Check in collection definition before continuing
                                optionsGlobal.collectionsEnabled &&
                                startsWith( optionsD.path, optionsGlobal.charCollectionsLeft) &&
                                endsWith(optionsD.path, optionsGlobal.charCollectionsRight )
                        )
                        {
                                var collectionKey = optionsD.path.substring(optionsGlobal.charCollectionsLeft.length, optionsD.path.length-optionsGlobal.charCollectionsRight.length);
                                var collection    = optionsGlobal.collections[ collectionKey ];
                                if ( !collection ) {
                                        exceptionThrow("No such collection is defined: " + optionsD.path);
                                }
                                else {
                                        var tmp = [index, 1];
                                        tmp.push.apply(tmp, collection);
                                        Array.prototype.splice.apply(dependencies, tmp);
                                }
                                return -1;
                        }

                        optionsD._index_ = index;    // _key_ can be different for an array later on
                } else {
                        optionsD._key_   = index;    // Highest priority key if an object
                }

                // Not using an own key, see if it is nested within the path
                optionsKeyGenerate(optionsD, optionsD.path);

                // === Reference to declared dependencies ===
                if ( optionsGlobal.charDependency && optionsGlobal.charDependency != '' &&
                                startsWith(optionsD.path, optionsGlobal.charDependency) &&
                                endsWith(optionsD.path, optionsGlobal.charDependency) )
                {

                        optionsD.path = optionsD.path.substring(1, optionsD.path.length-1);

                        // === Merge references with dependencies ===
                        // Check for a files definition
                        var optionsB = optionsGlobal.dependencies[optionsD.path];  // Bootstrap
                        if (optionsB) {

                                // This must be the key, cannot be overriden in the path as : key -> path
                                if ( !optionsD._key_ ) {
                                        optionsD._key_ = optionsD.path;
                                }

                                if ( !isString(optionsB) ) {
                                        merge(optionsD, optionsB);

                                        optionsB = optionsB.path;   // Ensure next line is a string or null
                                }

                                if ( optionsB ) {
                                        optionsKeyGenerate(optionsD, optionsB);
                                }

                        }

                }

                // === No M key, then use the name of the file for M ===
                if ( !optionsD._key_ ) {
                        optionsD._key_ = getFilename(optionsD.path, true);   // Either entire path or path without reference characters
                }

                // === With caller options ===
                if (promiseParent.options) {
                        merge(optionsD, promiseParent.options);
                }


                // === With global options for calls ===
                merge(optionsD, optionsGlobal.defaults);


                // ---------- PATH UP TO HERE IS NOT TOUCHED OTHER THAN KEY BEING STRIPPED OUT ----------

                // -- text!jsonp!
                pathJsonpTextTypes (optionsD);

                if ( optionsD.plugin === true ) {
                        optionsD.plugin = optionsD._key_;
                }

                // plugin value is either _key_ or a path such as MoCP
                if ( optionsD.plugin ) {
                        optionsD.path   = optionsD.plugin + "/" + optionsD.path;
                }
                // If plugin is specified as an option then we ignore the [PluginReference] style
                else {
                        var split = pluginSplit (optionsD.path);
                        if ( split.plugin ) {
                                optionsD.path   = optionsD.plugin + "/" + split.file;
                        }
                }

                // Is not defined by anyone already, for instance by a define block
                if ( !cache[optionsD.path] && !isAbsolutePath(optionsD.path) ) {
                        optionsD.path = getAbsoluteRoot() + optionsD.path;
                }

                return optionsD;
        }

        function optionsKeyGenerate(optionsD, path) {
                var i = path.indexOf(optionsGlobal.charKey);
                if ( ~i ) {
                        if ( !optionsD._key_ ) {
                                optionsD._key_ = path.substring (0, i).trim();
                        }
                        optionsD.path = path.substring (i + optionsGlobal.charKey.length).trim();
                }
                else {
                        optionsD.path = path;
                }
        }

        /**
         * json!text!path/to/file.js
         */
        function pathJsonpTextTypes(optionsD) {
                if ( startsWith(optionsD.path, types.jsonp + "!") ) {
                        optionsD.path = optionsD.path.substring( types.jsonp.length + 1 );
                        optionsD.type = types.jsonp;

                        pathJsonpTextTypes(optionsD);
                }
                else if ( startsWith(optionsD.path, types.text+ "!") ) {
                        optionsD.path = optionsD.path.substring( types.text.length + 1 );

                        // Highest priority for jsonp
                        if ( optionsD.type != types.jsonp ) {
                                optionsD.type = types.text;
                        }

                        pathJsonpTextTypes(optionsD);
                }

                else if ( optionsD.type == types.jsonp ) {
                        var qi = optionsD.path.indexOf("?");
                        if ( ~qi ) {
                                optionsD.path = optionsD.path.substring(0, qi-1) + jsonpCallback + "&" + optionsD.path.substring (qi+1);
                        } else {
                                optionsD.path += "?" + jsonpCallback;
                        }
                }
                /*
                 else if ( optionsD.type == types.text ) {
                 // No need to test for this but thats is the last scenario, but here we are not going to do anything
                 }
                 */
        }













        // ======================================= Stack ===========================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


        function $Stack() {
                return [];
        }
        function stackPush(fn, args) {
                stackArray.push(arguments);
        }
        function stackProcess(path) {
                var pushed = false;

                stackArray.isProcessing = true;
                for ( var i = 0; i < stackArray.length; i++ ) {
                        var s = stackArray[i];

                        if ( !pushed && stackIsDefineType( s[0] ) ) {
                                Array.prototype.unshift.call( s[1], path );  // First one expects the file path to be supplied to the define call
                                pushed = true;
                        }

                        // See stack() method parameters for index definitions
                        s[0].apply(that, s[1]);
                }
                stackArray.isProcessing = false;
                stackArray = [];
        }

        function stackIsEmpty() {
                return stackArray.length == 0;
        }
        function stackIsDefineType() {
                return isDefineTypeStack.apply(that, arguments);
        }







        // ======================================= Promise =========================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


        function promiseCreateDefine(path, status) {
                var promise                 = promiseCreateBasic(status);

                promise.path                = path;
                promise.dependants          = {};           // Those that depends on you
                promise.dependsOn           = {};
                promise.promiseCircular     = undefined;    // Marking that this might be set at a later stage if there are circular dependencies

                return promise;
        }

        function promiseCreateBasic(status) {
                var promise             = $Promise();
                promise.onready         = promise.done;
                promise.autoshim        = true;             // Default
                promiseSetStatus(promise, status);

                return promise;
        }
        function promiseSetStatus(promise, status) {
                promise.status = status;
        }

        /**
         * Plugin path
         */
        function promisePluginSet(promise, plugin) {
                promise.plugin = plugin;
        }

        /**
         * TODO Most require calls don't need to persist these on after fn, only M and args are then important
         * TODO Optimize
         */
        function promiseSetProperties(promiseParent, dependencies, callback, options) {
                promiseParent.dependencies = dependencies || [];
                promiseParent.callback     = callback;
                promiseParent.options      = options;
                promiseParent.M            = {};


                if ( ( options && options.args )  || optionsGlobal.defaults.args ) {
                        if ( isArray(dependencies) ) {
                                promiseParent.args = [];   // Only used when dependencies is an array
                        } else {
                                exceptionThrow("Option args:true can not be used on non array dependency format. Please use array format!");
                        }
                }
        }



        /**
         * We create a promise to handle the circular dependencies.
         * The promise will be hooked to the parent. And we ask the child, which also depends on the parent,
         * to let us know when it is done. We go on ignoring this child for now.
         * Once child is done, it returns, we are notified, and then reattach the return value to our M.
         */
        function promiseCircularHandle (promiseParent, promiseChild, circularEnd, optionsD) {
                var promiseCircular = promiseParent.promiseCircular;
                if ( !promiseCircular ) {
                        promiseParent.promiseCircular  = promiseCircular = promiseCreateBasic(0);

                        promiseCircular.onready = function() {
                                promiseCircular.onready.called++;
                                promiseCircular.done.apply(this, arguments);
                        };
                        promiseCircular.onready.called = 0;

                        promiseParent.onready = promiseCircular.onready;   // Re routes the onready calls to this circular handler instead
                }

                promiseCircular.onready.called--;
                promiseCircular.lock++;

                promiseChild.done(function () {
                        promiseParentSetKey(promiseParent, promiseChild, optionsD);

                        promiseCircular.lock--;
                        if ( promiseCircular.lock == 0 && !promiseCircular.isResolved ) {

                                if ( optionsGlobal.circularOnreadyRequired && promiseParent.onready.called == 0 ) {
                                        promiseResolve(promiseCircular, promiseParent);  // Will fire all the onready/done calls
                                }
                                else {
                                        var m = "There is a circular dependency within your code, please wrap your logic in a \n\n" +
                                                "this.onready(function() { \n " +
                                                "     .... \n" +
                                                "} ) \n\n" +
                                                "in order to gurantee that all dependencies are resolved when callback is called.\n\n" +
                                                "The circular dependency is between: \n" + promiseParent.path + "\n      <--->    \n" + promiseChild.path;

                                        if ( circularEnd != promiseChild.path ) {
                                                m += " \n\n It occurs from " + circularEnd;
                                        }

                                        exceptionThrow(m)
                                }

                        }
                });
        }

        function promiseCacheGetOrCreateBase(path, status) {
                return cache[path] || ( cache[path] = promiseCreateBasic(status) );
        }

        function promiseCacheGetOrCreateDefine(path, status) {
                return cache[path] || ( cache[path] = promiseCreateDefine(path, status) );
        }

        function promiseLock(promise) {
                promise.lock++;
        }

        function promiseUnlockResolveTry(promise) {
                promise.lock--;
                promiseResolveTry(promise);
        }
        function promiseResolveTry(promise) {
                if ( promise.lock == 0 && !promise.isResolved ) {
                        var returns;

                        if ( promise.callback ) {
                                if ( promise.args ) {
                                        returns = promise.callback.apply(promise, promise.args);
                                } else {
                                        returns = promise.callback.call(promise, promise.M);
                                }
                        }

                        if ( promiseIsOfDefineNature(promise) ) {
                                promise.returns =  returns; // To avoid confusion only define statements return values will be taken into consideration
                        }

                        promiseResolve(promise, promise);
                }
        }

        function promiseParentSetKeyUnlockResolveTryWhenChildDone(promiseParent, promiseChild, optionsD) {
                promiseChild.done(function () {
                        promiseParentSetKey(promiseParent, promiseChild, optionsD);
                        promiseUnlockResolveTry(promiseParent);
                });
        }

        function promiseParentSetKey(promiseParent, promiseChild, optionsD) {
                if ( ( promiseChild.autoshim || optionsD.shim ) && !promiseChild.returns ) {
                        if ( !optionsD.shim ) {
                                optionsD.shim = optionsD._key_;
                        }

                        promiseChild.returns = window[optionsD.shim];  // try to get for example jQuery from window instead
                }

                promiseParent.M[optionsD._key_]               = promiseChild.returns;

                if ( promiseParent.args ) {
                        promiseParent.args [optionsD._index_] = promiseChild.returns;
                }
        }

        function promiseResolve(promise0, promise1) {
                promise0.resolve.apply(promise0, promise1.args);  // The args are for onready. Will be either [M] or [,,] TODO review if [M] is really set
        }

        function promiseIsOfDefineNature() {
                return isDefineTypePromise.apply(this, arguments);
        }


        // ===================================== Other  methods ====================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        /**
         * Does a depend on b?
         * Returns were it found a backreference
         */
        function dependsOn(a, b) {
                var dependOn = cache[a].dependsOn;
                if ( dependOn[b] )  {
                        return a;
                }

                // Need to check the others recursively
                for ( a in dependOn ) {
                        a = dependsOn(a, b);
                        if ( a ) {
                                return a;
                        }
                }

                return false;
        }

        /**
         * Meaning they are either jsonp or define calls
         */
        function isDefineTypeStack(fn) {
                return fn == define || fn == jsonpResponse
        }

        // Only define and jsonp response calls have path set so this one or the other.
        // If jsonp then returns are already set
        function isDefineTypePromise(promise) {
                return promise.path && !promise.returns;
        }

        function exceptionLog(args) {
                var id = parseInt(Math.random()*100000);
                console.log( id + " : MoQR Error" , args);  // OBS! Keep this log call!
                return id;
        }

        function exceptionThrow(message) {
                if ( !optionsGlobal.isProduction ) {
                        var line = exceptionHeader(that.library);
                        throw str(
                                "\n",
                                line,
                                "\n", "Message:", "\n",
                                message,
                                "\n",
                                line
                        );
                }
        }












        // ======================================= Load stuff ======================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        function loadScript(path, fn, errorfn, options) {
                var element = document.createElement('script');
                element.setAttribute("type", 'text/javascript');
                element.setAttribute("src", path);

                return loadBase(element, fn, errorfn, options);
        }
        /**
         *  Will only work on same domain
         */
        function loadText(path, fn, errorfn, options) {
                options = options || {};

                var file = new XMLHttpRequest();
                file.onreadystatechange = function () {
                        if (file.readyState === 4) {
                                file.onreadystatechange = null;

                                // Status zero
                                if (file.status === 200 || file.status === 0 ) {
                                        fn(file, file.responseText);
                                }
                        }
                };

                file.onerror = function(file) {
                        errorfn && errorfn(file);
                };

                // Relative paths in XMLHttpRequest is relative to the current location.href
                file.open("GET", path, options.async != false );   // Defaults to true
                file.send(null);
        }

        function loadBase(element, fn, errorfn, options) {
                element.loaded = false;

                if (element.readyState){  // IE
                        element.onreadystatechange = function(){
                                if (element.readyState == "loaded" || element.readyState == "complete"){
                                        element.onreadystatechange = null;

                                        loadBaseOnload(element, fn);
                                }
                        };
                } else {                 // Others
                        element.onload = function() {
                                loadBaseOnload(element, fn);
                        };
                }

                element.onerror = function() {
                        errorfn && errorfn(element);
                };


                if ( options.elementAsync !== undefined ) {
                        element.setAttribute( "async", options.elementAsync );
                }

                if ( options.elementDefer !== undefined ) {
                        element.setAttribute("defer", options.elementDefer);
                }

                if ( options.elementBeforeAppend ) {
                        element = options.elementBeforeAppend(element);
                }

                (options.elementAppendTo || document.head || loadBase.head || (loadBase.head = document.getElementsByTagName('head')[0]) || document.body).appendChild(element);

                return element;
        }

        function loadBaseOnload(element, fn) {
                if (element.loaded != true) {
                        element.loaded = true;
                        if ( fn ) fn(element);
                }
        }






















        // ======================================= MoXY ============================================
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        function isAbsolutePath(path) {
                if ( !isAbsolutePath.regexp ) {
                        isAbsolutePath.regexp = new RegExp("^(?:/|.*://)");
                }

                return isAbsolutePath.regexp.test(path);
        }

        function getAbsolutePath(path) {
                if ( isAbsolutePath(path) ) {
                        return path;
                }

                return getAbsoluteRoot() + path;
        }

        function getAbsoluteRoot() {
                if ( isAbsolutePath(optionsGlobal.path.app.root) ) {
                        return optionsGlobal.path.app.root;
                }
                return getAbsoluteHost(optionsGlobal.path.app.root);
        }
        function getAbsoluteHost(path) {
                if ( location.protocol == "file:" ) {
                        return path;
                }
                else {
                        return location.protocol + "//" + location.hostname + ":" + location.port + "/" + path;
                }
        }

        function isArray(o) {
                return o.splice;
        }
        function isString(o) {
                return o.substring;
        }

        function getFilename(path, ignoreFileEnding) {
                if ( !getFilename.regexp ) {
                        getFilename.regexp = new RegExp("^[/\\\\]?(?:.+[/\\\\]+?)?(.+?)[/\\\\]?$");
                }

                var filename = path.match(getFilename.regexp)[1];
                if ( ignoreFileEnding == true ) {
                        var i    = filename.lastIndexOf(".");
                        filename = filename.substring(0, ~i ? i : filename.length);
                }
                return filename;
        }

        function endsWith(str, s) {
                return str.indexOf(s, str.length - s.length) !== -1;
        }
        function startsWith(str, s) {
                return str.lastIndexOf(s, 0) === 0;
        }

        function $Promise() {
                var stack = [];
                var lastfn = undefined;
                var args = undefined;

                var that = {
                        isPromise : true,

                        lock: 0,

                        done: function (fn) {
                                if (args != undefined) {
                                        call(fn);
                                } else {
                                        stack.push(fn);
                                }

                                return that;
                        },

                        last: function (fn) {
                                if (lastfn != undefined) {
                                        throw "There can only be one last!";
                                } else if (args != undefined) {
                                        call(fn);
                                } else {
                                        lastfn = fn;
                                }

                                return that;
                        },

                        resolve: function () {
                                if (stack != null) {
                                        that.isResolved = true;

                                        args = arguments;

                                        if (lastfn) {
                                                stack.push(lastfn);
                                        }

                                        for (var i = 0; i < stack.length; i++) {
                                                call(stack[i]);
                                        }
                                }

                                lastfn = null;
                                stack  = null;

                                return that;
                        },

                        isResolved: false
                };

                function call(fn) {
                        fn.apply(that, args);
                }

                return that;
        }

        var hasOwnProperty = Object.prototype.hasOwnProperty;  // If somebody adds a property hasOwnProperty to our object we call the prototype one instead
        function merge(a, b) {
                if ( a ) {
                        for ( var property in b ) {
                                if ( !hasOwnProperty.call(a, property) ) {
                                        a[property] = b[property];
                                }
                        }
                } else {
                        a = b;
                }

                return a;
        }

        function $O(o) {
                return {
                        o : o
                };
        }


        function exceptionHeader(library) {
                var lineArray = xChars(30, '=').split("");
                lineArray.splice(parseInt(lineArray.length - 1) / 2 + 1, 0, " " + library + " Exception! "); // Push in the word ERROR in the middle
                var line = lineArray.join("");
                return line;
        }

        function str() {
                return Array.prototype.join.call(arguments, "");
        }

        function xChars(i, iChar) {
                var chars = "";
                for ( ;i--; )  chars += iChar;
                return chars;
        }

        var pluginLeft = "$", pluginRight = "$";
        function pluginSplit(str) {
                if ( str && startsWith(str, pluginLeft) ) {
                        var i = str.indexOf( pluginRight, pluginLeft.length );
                        if ( ~i ) {
                                return {
                                        plugin : str.substring ( pluginLeft.length, i ),
                                        file   : str.substring ( i+pluginRight.length )
                                };
                        }
                }
                return {file: str};
        }

})();