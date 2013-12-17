(function() {

        MoQR.options.dependencies = {
                jsFile0    : {
                        path    : "libs/0.js"
                },

                jQuery : "http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"
        };

        MoQR.options.collections = {
                myArray : ["|jsFile0|", "|jQuery|"]
        };

        var start = new Date();
//        MoQR.require([
//                { path: "key -> http://ip.jsontest.com", type:"jsonp" }, "|jsFile0|"], function(M) {
//                console.log("Callback: Bootstrap.js 0000000000", M, new Date() - start);
//
//                console.log("================ 2 =================")
//
//                MoQR.require(["|jsFile0|"], function(M) {
//                        console.log("Callback: Bootstrap.js 1", M, new Date() - start);
//
//                        console.log("================ 3 =================")
//
//                        MoQR.require(["key_0.js[1] -> |jsFile0|"], function(M) {
//                                console.log("Callback: Bootstrap.js 3", M, new Date() - start)
//                        });
//
////                        MoQR.require(["key_0.js[namedDefined0] -> namedDefine0"], function(M) {
////                                console.log("Callback: Bootstrap.js 4", M, new Date() - start)
////                        });
////
//                        console.log("================ 4 =================")
//
//                        MoQR.require("key", ["key_3.js -> libs/3.js"], function(M) {
//                                console.log("Callback: Bootstrap.js 5", M, new Date() - start)
//                        });
//
//                        setTimeout(function() {
//                                MoQR.require("key", {}, function(M) {
//                                        console.log("Callback: Bootstrap.js 6", M, new Date() - start)
//                                });
//
//                                MoQR.require("key1", ["key_31.js -> libs/3.js"], function(M) {
//                                        console.log("Callback: Bootstrap.js 7", M, new Date() - start)
//                                });
//
////                                MoQR.require("key1", ["key_31.js -> libs/4.js"], function(M) {
////                                        console.log("Callback: Bootstrap.js 8", M, new Date() - start)
////                                });
//
//                                MoQR.clear("key").require("key", {}, function(M) {
//                                        console.log("Callback: Bootstrap.js 9", M, new Date() - start)
//                                });
//
//                                MoQR.require(["libs/3.js"], function(M) {
//                                        console.log("Callback: Bootstrap.js 10", M, new Date() - start)
//                                });
//
//                        }, 1000)
//
//                });
//
//
//        });
//
//        MoQR.require(["libs/2.js"], function(M) {
//                console.log("Callback: Bootstrap.js 22", M, new Date() - start);
//        });
//
//
//
//        MoQR.require(["libs/3.js"], function(M) {
//                console.log("Callback: Bootstrap.js 33", M, new Date() - start);
//        });
//
//
//        console.log("start bootstrap")
//        MoQR.require(["libs/1.js"], function(M) {
//                console.log("Callback: Bootstrap.js 33", M, new Date() - start);
//        });
//
//
//        MoQR.require([{ path: "http://ip.jsontest.com", type:"jsonp" }], function(M) {
//                console.log("Bootstrap jsonp", M)
//        });
//
//
//        setTimeout(function() {
//                MoQR.require([{ path: "http://ip.jsontest.com", type:"jsonp" }], function(M) {
//                        console.log("Bootsrap jsonp with timeout", M)
//                });
//        }, 2000);
//
//
//
//        MoQR.require(["|jQuery|"], function(M) {
//                console.log("jQueryyyyyyyysssssssssssssssssssssssssssssssyyyyy on window element", jQuery)
//                console.log("jQueryyyyyyyyyyyyy on M", M)
//        });
//
//        MoQR.require(["[myArray]"], function(M) {
//                console.log("jQueryyyyyyyysssssssssssssssssssssssssssssssyyyyy on window element")
//                console.log("jQueryyyyyyyyyyyyy on M", M)
//        });

//        MoQR.define(["|jsFile0|"], function(M) {
//                console.log("Boostrap test", M)
//
//                // Will also work with ../../../app/namedDefine1.js
//                MoQR.require(["namedDefine1.js"], function(M) {
//                        console.log("Boostrap test11111", M);
//                });
//
//        });


//        MoQR.define("abc", [], function() {
//
//                this.onready(function() {
//                        MoQR.require(["abc"], function(M) {
//                                M.abc = "aaaaa";
//                                console.log(1, M)
//
//                                MoQR.require(["abc"], function(M) {
//                                        console.log(2, M)
//                                });
//
//                        });
//                });
//
//                return "returns:abc";
//        });


//        MoQR.require(["libs/7.js"], function(M) {
//                console.log("booooootstrap", M)
//        });

//        MoQR.define(["2"], function(M) {
//                console.log("a", M );
//                return "returns:1"
//        });
//
//        MoQR.require(["1"], function(M) {
//                console.log("0", M );
//                return "returns:0"
//        });
//
//        MoQR.define("1", ["2"], function(M) {
//                console.log("1", M );
//                return "returns:1"
//        });
//
//        MoQR.define("2", ["3"], function(M) {
//                console.log("2", M );
//                return "returns:2"
//        });
//
//        MoQR.define("3", [], function(M) {
//                console.log("3", M)
//                return "returns:3"
//        });




//         MoQR.loadText("../../../app/views/moframework/moqr.html", function(file, text) {
//                 console.log("text", text, file)
//         }, function(file) {
//                 console("error", file)
//         });



        MoQR.require(["a -> [MoQR]ui/views/test/moqr.html"], function(M) {
                console.log("aaaa", M)
        });

//        MoQR.require(["b -> text!views/moframework/mocp.html"], function(M) {
//                console.log("bbbb", M)
//        })

})();













