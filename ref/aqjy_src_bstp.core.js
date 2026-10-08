var BSTP = {
	keyCode: {
		ENTER: 13, ESC: 27, END: 35, HOME: 36,
		SHIFT: 16, TAB: 9,
		LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40,
		DELETE: 46, BACKSPACE:8
	},
	pageInfo: {pageNum:"page.page", pageSize:"page.size", orderField:"page.sort", orderDirection:"page.sort.dir"},
	statusCode: {ok:200, error:300, timeout:301},
	keys: {statusCode:"statusCode", message:"message"},
	_set:{
		loginUrl:"", //session timeout
		loginTitle:"", //if loginTitle open a login dialog
		debug:false
	},
	msg:function(key, args){
		var _format = function(str,args) {
			args = args || [];
			var result = str || "";
			for (var i = 0; i < args.length; i++){
				result = result.replace(new RegExp("\\{" + i + "\\}", "g"), args[i]);
			}
			return result;
		}
		return _format(this._msg[key], args);
	},
	loadLogin:function(){
		alertMsg.close();
		if ($.pdialog && BSTP._set.loginTitle) {
			$.pdialog.open(BSTP._set.loginUrl, "login", BSTP._set.loginTitle, {area: ['500px', '300px']});
		} else {
			window.location = BSTP._set.loginUrl;
		}
	},
	jsonEval:function(data) {
		try{
			if ($.type(data) == 'string')
				return eval('(' + data + ')');
			else return data;
		} catch (e){
			return {};
		}
	},
	randomSort: function(a, b) {
		// 通过随机产生0到1的数，然后判断是否大于0.5从而影响排序，产生随机性的效果。
		return Math.random() > .5 ? -1 : 1;
	},
	ajax: function(type, url, params, success, timeout, error, context, dataType) {
		var options = {
			type: type || 'POST',
			url: url,
			data: params,
//			dataType: dataType || 'json',
			cache: false,
//			global: false, 
//			beforeSend: function(XMLHttpRequest) {
//				this._index = layer.load(2);
//	        },
//	        complete:function(XMLHttpRequest,textStatus) {
//	        	layer.close(this._index);
//	        },
			success: function(result){
				if(success)
					success.call(context, result);
				else
					BSTP.ajaxDone(result);
			}
		};
		if (error)
			options.error = error;
		else
			options.error = BSTP.ajaxError;
		if (timeout)
			options.timeout = timeout;
		if(context)
			options.context = context;
		jQuery.ajax(options);
	},
	ajaxError:function(XMLHttpRequest, textStatus, errorThrown){
		var msg = '';
		var status = XMLHttpRequest.status;
		switch(status) {
			case 404:
				msg = '对不起，没有找到您要的页面！';
				break;
			case 500:
				msg = '对不起，您请求的服务出错了，请重试或请求其他服务！';
				break;
		}
		if(msg != '') {
			alertMsg.error(msg);
		}
		return false;
	},
	ajaxDone:function(json){
		if(json[BSTP.keys.statusCode] == BSTP.statusCode.error) {
			if(json[BSTP.keys.message] && alertMsg) 
				alertMsg.error(json[BSTP.keys.message]);
		} else if (json[BSTP.keys.statusCode] == BSTP.statusCode.timeout) {
			if(alertMsg) 
				alertMsg.error(json[BSTP.keys.message] || BSTP.msg("sessionTimout"), {yes:BSTP.loadLogin});
			else 
				BSTP.loadLogin();
		} else if (json[BSTP.keys.statusCode] == BSTP.statusCode.ok){
			if(json[BSTP.keys.message] && alertMsg) 
				alertMsg.correct(json[BSTP.keys.message]);
		};
	},
	init:function(options){
		var op = $.extend({loginUrl:"login.html", loginTitle:null}, options);
		this._set.loginUrl = op.loginUrl;
		this._set.loginTitle = op.loginTitle;
		$.extend(BSTP.pageInfo, op.pageInfo);
	},
	/** 面包屑导航：更新 */
	updateBreadcrumb: function(){
		var $temp = $(".navigation");
		if(!$temp || $temp.length == 0)
			return;
		var $breadcrumb = $('.breadcrumb');
		var temp = $temp.html();
		$('.breadcrumb li:not(:first)').remove();
		$breadcrumb.append(temp);
		var $breadcrumbLi2 = $breadcrumb.find('li:eq(1)').find('a');
		if($breadcrumbLi2 && $breadcrumbLi2.length > 0) {
			$breadcrumbLi2.attr('href', $breadcrumb.data('navTabBaseData').url);
			$breadcrumbLi2.attr('rel', $breadcrumb.data('navTabBaseData').rel);
		}
		if($temp.hasClass('breadcrumb-line')) {
			$breadcrumb.addClass('breadcrumb-line');
		}
		else {
			$breadcrumb.removeClass('breadcrumb-line');
		}
	},
	/**
	 * 面包屑导航绑定基础数据，并选中左侧菜单(如果有的话)
	 * @param baseData
	 * @param rel 需要选中的左侧菜单条目的rel
	 */
	breadcrumbBase: function(baseData, rel) {
		$('.breadcrumb').data('navTabBaseData', baseData);
		var $leftsideA = $('.leftside li a');
		if($leftsideA && $leftsideA.length > 0) {
			if(!rel || rel == '') {
				rel = baseData.rel;
			}
			$leftsideA.removeClass('active');
			for(var i=0; i<$leftsideA.length; i++) {
				if(rel == $leftsideA.eq(i).attr('rel')) {
					$leftsideA.eq(i).addClass('active');
				}				
			}
		}
	},
	/**
	 * 一级菜单对应主页面的处理函数
	 * @param navTabUrl {String型的url}[可选]：主体内容部分需要加载数据的url，优先级高
	 * @param navTabBase {String型的a标签}[无左侧菜单时必选]：本主页的根链接(无左侧菜单时,必需; 有则自动读取第一条左侧菜单),用于处理面包屑导航
	 * @param navTabRel {String}[可选]：有左侧菜单时需要选中的左侧菜单条目(没有navTabUrl时默认取第一条)
	 */
	openMain: function(navTabUrl, navTabBase, navTabRel) {
		var interval = window.setInterval(function(){
			var $mainPanel = $('.main-panel');
			if($mainPanel && $mainPanel.length > 0){
				try{
					navTabUrl = $.trim(navTabUrl);
					navTabBase = $.trim(navTabBase);
					navTabRel = $.trim(navTabRel);
					
					var $a, navTabBaseData = {};
					var $leftside = $('.leftside');
					if($leftside && $leftside.length > 0) {
						if(navTabRel && navTabRel != '') {
							$a = $leftside.find('li a[rel=' + navTabRel + ']');
						}
						else {
							$a = $leftside.find('li a').eq(0);
						}
					}
					else {
						$a = $(navTabBase);
					}
					navTabBaseData.url = $a.attr('href');
					navTabBaseData.rel = $a.attr('rel');
					
					var url = '';
					if(navTabUrl && $.trim(navTabUrl) != '') {
						url = navTabUrl;
					}
					else {
						url = navTabBaseData.url;
					}
					
					$mainPanel.loadUrl(url, null, function() {
						BSTP.breadcrumbBase(navTabBaseData, navTabRel);
						BSTP.updateBreadcrumb();
					});
					window.clearInterval(interval);
				}catch(e){console.log(e);}
			} else {
				window.clearInterval(interval);
			}
		}, 100);
	}
};

(function($){
	$.setRegional = function(key, value){
		if (!$.regional) $.regional = {};
		$.regional[key] = value;
	};
	
	$.fn.extend({
		/**
		 * @param {Object} op: {type:GET/POST, url:ajax请求地址, data:ajax请求参数列表, callback:回调函数 }
		 */
		ajaxUrl: function(options){
			var $this = $(this);
			var op = $.extend({type: 'GET'}, options);
			BSTP.ajax(op.type, op.url, op.data, function(response){
				var json = BSTP.jsonEval(response);
				if (json[BSTP.keys.statusCode] == BSTP.statusCode.error){
					if (json[BSTP.keys.message]) alertMsg.error(json[BSTP.keys.message]);
				} else {
					if (!json[BSTP.keys.statusCode] || json[BSTP.keys.statusCode] == BSTP.statusCode.ok){
						$this.html(response);
					}
					if ($.isFunction(op.callback)) op.callback(response);
				}
				
				if (json[BSTP.keys.statusCode] == BSTP.statusCode.timeout){
					alertMsg.error(json[BSTP.keys.message] || BSTP.msg("sessionTimout"), {time: 0, yes:function(){
						BSTP.loadLogin();
					}});
				}
			});
		},
		loadUrl: function(url,data,callback){
			$(this).ajaxUrl({url:url, data:data, callback:callback});
		},
		/**
		 * 判断当前元素是否已经绑定某个事件
		 * @param {Object} type
		 */
		isBind:function(type) {
			var _events = $(this).data("events");
			return _events && type && _events[type];
		},
		/**
		 * 输出firebug日志
		 * @param {Object} msg
		 */
		log:function(msg){
			return this.each(function(){
				if (console) console.log("%s: %o", msg, this);
			});
		}, 
		/**
		 * 点击元素外的其他地方自动隐藏
		 */
		autoHide: function() {
			var ele = $(this);
			$(document).on('click', function(e) {
				if(ele.is(':visible') && (!$(e.target)[0].isEqualNode(ele[0]) && ele.has(e.target).length === 0)) {
					ele.hide();
				}
				e.stopPropagation();
				return false;
			});
			return this;
		}
	});
	
	/**
	 * 扩展String方法
	 */
	$.extend(String.prototype, {
		isPositiveInteger:function(){
			return (new RegExp(/^[1-9]\d*$/).test(this));
		},
		isInteger:function(){
			return (new RegExp(/^\d+$/).test(this));
		},
		isNumber: function(value, element) {
			return (new RegExp(/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/).test(this));
		},
		trim:function(){
			return this.replace(/(^\s*)|(\s*$)|\r|\n/g, "");
		},
		startsWith:function (pattern){
			return this.indexOf(pattern) === 0;
		},
		endsWith:function(pattern) {
			var d = this.length - pattern.length;
			return d >= 0 && this.lastIndexOf(pattern) === d;
		},
		replaceSuffix:function(index){
			return this.replace(/\[[0-9]+\]/,'['+index+']').replace('#index#',index);
		},
		trans:function(){
			return this.replace(/&lt;/g, '<').replace(/&gt;/g,'>').replace(/&quot;/g, '"');
		},
		encodeTXT: function(){
			return (this).replaceAll('&', '&amp;').replaceAll("<","&lt;").replaceAll(">", "&gt;").replaceAll(" ", "&nbsp;");
		},
		replaceAll:function(os, ns){
			return this.replace(new RegExp(os,"gm"),ns);
		},
		replaceTm:function($data){
			if (!$data) return this;
			return this.replace(RegExp("({[A-Za-z_]+[A-Za-z0-9_]*})","g"), function($1){
				return $data[$1.replace(/[{}]+/g, "")];
			});
		},
		replaceTmById:function(_box){
			var $parent = _box || $(document);
			return this.replace(RegExp("({[A-Za-z_]+[A-Za-z0-9_]*})","g"), function($1){
				var $input = $parent.find("#"+$1.replace(/[{}]+/g, ""));
				return $input.val() ? $input.val() : $1;
			});
		},
		isFinishedTm:function(){
			return !(new RegExp("{[A-Za-z_]+[A-Za-z0-9_]*}").test(this)); 
		},
		skipChar:function(ch) {
			if (!this || this.length===0) {return '';}
			if (this.charAt(0)===ch) {return this.substring(1).skipChar(ch);}
			return this;
		},
		isValidPwd:function() {
			return (new RegExp(/^([_]|[a-zA-Z0-9]){6,32}$/).test(this)); 
		},
		isValidMail:function(){
			return(new RegExp(/^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/).test(this.trim()));
		},
		isSpaces:function() {
			for(var i=0; i<this.length; i+=1) {
				var ch = this.charAt(i);
				if (ch!=' '&& ch!="\n" && ch!="\t" && ch!="\r") {return false;}
			}
			return true;
		},
		isPhone:function() {
			return (new RegExp(/(^([0-9]{3,4}[-])?\d{3,8}(-\d{1,6})?$)|(^\([0-9]{3,4}\)\d{3,8}(\(\d{1,6}\))?$)|(^\d{3,8}$)/).test(this));
		},
		isUrl:function(){
			return (new RegExp(/^[a-zA-z]+:\/\/([a-zA-Z0-9\-\.]+)([-\w .\/?%&=:]*)$/).test(this));
		},
		isExternalUrl:function(){
			return this.isUrl() && this.indexOf("://"+document.domain) == -1;
		}
	});
})(jQuery);