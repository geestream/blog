// Copyright (c) 2010 Claudio Gil <claudio.f.gil@gmail.com>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var TumblrPostMap = (function() {
	var map = null;
	var points = [];
	var infos = [];
	var markers = {};
	var trackline = null;
	var tracksContainer = null;
	var markerId = "";
	
	function recenterMap(center) {
		map && center && map.setCenter(center);
	}
	
	function checkAnchor() {
		var hash = document.location.hash;
		
		if (!hash || markerId == hash) {
			return;
		}
		
		markerId = hash;
		var m = markers[markerId];
		
		if (!m) {
			return;
		}
		
		google.maps.event.trigger(m, 'click');
	}
	
	var processor = {
		process: function(post) {
			var postId = this.getPostId(post);
			var icon = this.getIcon(post);
			var title = this.getTitle(post);
			var body = this.getBody(post);
			var link = this.getPostLink(post);
			var date = this.getDate(post);
			var geo = this.getLatLng(post, title, body);
			var content = this.getContent(post, title, body, geo, link);
			
			var plainTitle = (title && $('<div>' + title + '</div>').text()) || "";
			var plainBody = $('<div>' + body + '</div>').find('p').first().html();
			
			return {
				postId: postId,
				date: date,
				icon: icon,
				geo: geo,
				title: title,
				content: content,
				plainTitle: plainTitle,
				plainBody: plainBody
			};
		},
		getPostId: function(post) {
			return post['id'];
		},
		getIcon: function(post) {
			var url100 = post['photo-url-100'];
			return url100 && '<img src="' + url100 + '"></img>';
		},
		getDate: function(post) {
			return new Date(post['unix-timestamp'] * 1000);
		},
		getPostLink: function(post) {
			return post['url'];
		},
		getLatLng: function(post, title, body) {
			return this.createLatLngFrom(body);
		},
		createLatLngFrom: function(source) {
			var geo = $('<div>' + source + '</div>').find('.geo').first();
			
			if (!geo) {
				return null;
			}
			
			var lat = parseFloat($(geo).find('.latitude').text());
			var lng = parseFloat($(geo).find('.longitude').text());
			
			return new google.maps.LatLng(lat, lng);
		}
	};
	
	var photo = $.extend({}, processor, {
		getTitle: function(post) {
			return post['photo-caption'];
		},
		getBody: function(post) {
			if (post.photos.length == 0) {
				return '<img src="' + post['photo-url-75'] + '"></img>';
			}
			else {
				var body = "";
				for (var i = 0; i < post.photos.length; i++) {
					body += '<img src="h' + post.photos[i]['photo-url-75'] + '"></img>'
				}
				
				return body;
			}
		},
		getLatLng: function(post, title, body) {
			return this.createLatLngFrom(title);
		},
		getContent: function(post, title, body, geo, link) {
			return '<p>' + body + title + '</p><p><a href="' + link + '">' + link + '</a></p>';
		}
	});

	var regular = $.extend({}, processor, {
		titleKey: 'regular-title',
		bodyKey: 'regular-body',
		
		getTitle: function(post) {
			return post[this.titleKey];
		},
		getBody: function(post) {
			return post[this.bodyKey];
		},
		getContent: function(post, title, body, geo, link) {
			return '<h1>' + title + '</h1>' + body + '<p><a href="' + link + '">' + link + '</a></p>';
		}
	});
	
	var quote = $.extend({}, regular, {
		titleKey: 'quote-text',
		bodyKey: 'quote-source',
		
		getContent: function(post, title, body, geo, link) {
			return '<p><em>' + title + '</em></p><p>-- ' + body + '</p><p><a href="' + link + '">' + link + '</a></p>';
		}
	});
	
	processors = {
			photo: photo,
			regular: regular,
			quote: quote
	};
	
	return {
		createMap: function(options) {
			var el = document.getElementById(options.mapId);
			
			if (!el) {
				return;
			}
			
			map = new google.maps.Map(el, options.mapOptions);
			this.requestPosts(0);
		},
		requestPosts: function(pos) {
			$.getScript('/api/read/json?callback=TumblrPostMap.process&tagged=geo&start=' + pos);
		},
		process: function(data) {
			for (var i=0; i < data.posts.length; i++) {
				var post = data.posts[i];
				var processor = processors[post.type];
				
				if (! processor) {
					continue;
				}
				
				var fields = processor.process(post);
				if (! fields.geo) {
					continue;
				}
								
				var infowindow = new google.maps.InfoWindow({
					content: '<div class="infocontent">' +  fields.content + '</div>'
				});
				
				infowindow.set("isdomready", false);
				
				var marker = new google.maps.Marker({
					position: fields.geo,
					map: map,
					title: fields.plainTitle
				});
				
				var createMarkerClickHandler = function(m, info) {
					return function() {
						for (var i = 0; i < infos.length; i++) {
							infos[i].close();
						}
						
						info.open(map, m);
					};
				};
				
				var createInfowindowDomReadyHandler = function (infowindow) {
					return function() {
						if (infowindow.get("isdomready")) {
							// show the infowindow by setting css 
							jQuery('.infocontent').css('visibility', 'visible');                   
						}
						else {
							// trigger a domready event again.
							google.maps.event.trigger(infowindow, 'content_changed');
							infowindow.set("isdomready", true);
						}
					};
				};
				
				google.maps.event.addListener(marker, 'click', createMarkerClickHandler(marker, infowindow));
				google.maps.event.addListener(infowindow, 'domready', createInfowindowDomReadyHandler(infowindow));
				
				if (! map.getCenter()) {
					if (!location.hash || location.hash == "#p" + fields.postId) {
						// center on last post and open info
						recenterMap(fields.geo);
						infowindow.open(map, marker);
					}
				}
				
				points.push(fields.geo);
				infos.push(infowindow);
				markers["#p" + fields.postId] = marker;
			}
			
			var start = data['posts-start'];
			var count = data.posts.length;
			var total  = parseInt(data['posts-total']);
			
			if (count > 0 && start + count < total) { // not last page
				this.requestPosts(start + count);
			} else {
				if (points.length > 1) {
					trackline = new google.maps.Polyline({
						path: points,
						strokeColor: "#0000FF",
						strokeOpacity: 0.8,
						strokeWeight: 3
					});

					trackline.setMap(map);
				}
			
				if (! map.getCenter()) {
					// if we don't have a center then use Uluru
					recenterMap(new google.maps.LatLng(-25.345, 131.036111));
				}
				
				// check for changes in hash to focus on selected marker
				setInterval(checkAnchor, 300); 
			}
		}
	};
})();

//
// plugin
//

(function($) {
  $.fn.tumblrPostMap = function(options) {
	var defaults = {
		mapId: 'tumblrpostmap',
		mapSize: undefined,
		mapOptions: {
			zoom: 8,
			mapTypeId: google.maps.MapTypeId.HYBRID
		}
	};
    
    var options = $.extend(true, defaults, options);
    
    // insert map div
    var mapDiv = $('<div/>').attr({ id: options.mapId });    
    $(this).hide();
    $(this).after(mapDiv);
    
    // set explicit size, needed by google maps
    mapDiv.css(options.mapSize || { width: '100%', height: Math.round($(this).parent().width() * 9.0 / 16) + 'px' });
    
    // initialize map
    TumblrPostMap.createMap(options);
    
    return this;
  };
})(jQuery);
