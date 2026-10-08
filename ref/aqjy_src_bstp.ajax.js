/**
 * @author huxf
 * 
 */

/**
 * 普通ajax表单提交
 * @param {Object} form
 * @param {Object} callback
 * @param {String} confirmMsg 提示确认信息
 */
function validateCallback(form, callback, confirmMsg) {
	var $form = $(form);
	
	if (!$form.valid()) {
		return false;
	}
	
	var _submitFn = function(){
		BSTP.ajax(null, $form.attr("action"), $form.serializeArray(), callback);
	}
	
	if (confirmMsg) {
		alertMsg.confirm(confirmMsg, {okCall: _submitFn});
	} else {
		_submitFn();
	}
	
	return false;
}
/**
 * 带文件上传的ajax表单提交
 * @param {Object} form
 * @param {Object} callback
 */
function iframeCallback(form, callback){
	var $form = $(form), $iframe = $("#callbackframe");
	
	if(!$form.valid()) {return false;}

	if ($iframe.size() == 0) {
		$iframe = $("<iframe id='callbackframe' name='callbackframe' src='about:blank' style='display:none'></iframe>").appendTo("body");
	}
	if(!form.ajax) {
		$form.append('<input type="hidden" name="ajax" value="1" />');
	}
	form.target = "callbackframe";
	
	_iframeResponse($iframe[0], callback || DWZ.ajaxDone);
}
function _iframeResponse(iframe, callback){
	var $iframe = $(iframe), $document = $(document);
	
	$document.trigger("ajaxStart");
	
	$iframe.bind("load", function(event){
		$iframe.unbind("load");
		$document.trigger("ajaxStop");
		
		if (iframe.src == "javascript:'%3Chtml%3E%3C/html%3E';" || // For Safari
			iframe.src == "javascript:'<html></html>';") { // For FF, IE
			return;
		}

		var doc = iframe.contentDocument || iframe.document;

		// fixing Opera 9.26,10.00
		if (doc.readyState && doc.readyState != 'complete') return; 
		// fixing Opera 9.64
		if (doc.body && doc.body.innerHTML == "false") return;
	   
		var response;
		
		if (doc.XMLDocument) {
			// response is a xml document Internet Explorer property
			response = doc.XMLDocument;
		} else if (doc.body){
			try{
				response = $iframe.contents().find("body").text();
				response = jQuery.parseJSON(response);
			} catch (e){ // response is html document or plain text
				response = doc.body.innerHTML;
			}
		} else {
			// response is a xml document
			response = doc;
		}
		
		callback(response);
	});
}

/**
 * 表单提交回调函数
 * callbackType="forward"时需要forwardUrl值
 * <form action="/user.do?method=save" onsubmit="return validateCallback(this, navTabAjaxDone)">
 * 
 * form提交后返回json数据结构statusCode=DWZ.statusCode.ok表示操作成功, 做页面跳转等操作. statusCode=DWZ.statusCode.error表示操作失败, 提示错误原因. 
 * statusCode=DWZ.statusCode.timeout表示session超时，下次点击时跳转到DWZ.loginUrl
 * {"statusCode":"200", "message":"操作成功", "navTabId":"navNewsLi", "forwardUrl":"", "callbackType":"closeCurrent", "rel"."xxxId"}
 * {"statusCode":"300", "message":"操作失败"}
 * {"statusCode":"301", "message":"会话超时"}
 * 
 */
function navTabAjaxDone(result){
	var json = BSTP.jsonEval(result);
	BSTP.ajaxDone(json);
	if (json[BSTP.keys.statusCode] == BSTP.statusCode.ok){
		var $panel;
		if(json.rel) {
			$panel = $('#' + json.rel);
		}
		else {
			$panel = $('.main-panel');
		}
		
		if ("forward" == json.callbackType) {
			$panel.loadUrl(json.forwardUrl, null, null);
		} 
		else {
			var $host = $panel.find('.pageBox').children().eq(0);
			_pageBreak($host, json.rel, null);
		}
	}
}

/**
 * dialog上的表单提交回调函数
 * 当前navTab页面有pagerForm就重新加载
 * 服务器转回navTabId，可以重新载入指定的navTab. statusCode=DWZ.statusCode.ok表示操作成功, 自动关闭当前dialog
 * 
 * form提交后返回json数据结构,json格式和navTabAjaxDone一致
 */
function dialogAjaxDone(result){
	var json = BSTP.jsonEval(result);
	BSTP.ajaxDone(json);
	if (json[BSTP.keys.statusCode] == BSTP.statusCode.ok){
		if('closeCurrentNotReload' != json.callbackType && 'forwardNotReload' != json.callbackType){
			var $panel;
			if(json.rel) {
				$panel = $('#' + json.rel);
			}
			else {
				$panel = $('.main-panel');
			}
			var $host = $panel.find('.pageBox').children().eq(0);
			_pageBreak($host, json.rel, null);
		}
		
		if ('closeCurrent' == json.callbackType || 'closeCurrentNotReload' == json.callbackType) {
			$.pdialog.closeCurrent();
		}
	}
}

/**
 * 列表查询: 处理div上的局部查询, 会重新载入指定div
 * @param obj form表单
 * @param target 查询结果的刷新对象，可空，局部刷新时使用
 */
function divSearch(form, target){
	return _pageBreak($(form), target, {data: {pageNum: 1}});
}
/**
 * 获取查询条件（form表单）
 * @param $form
 * @returns {url: '', params: [{name: '', value: ''}], target: ''}
 */
function _getSearchFormParams($form) {
	var params = $form.serializeArray();
	var url = $form.attr("action");
	return {url: url, params: params};
}
/**
 * 获取查询条件（非form表单）
 * @param $pageBox
 * @returns {url: '', params: [{name: '', value: ''}], target: ''}
 */
function _getSearchItemParams($pageBox) {
	//获取查询条件
	var params = [];
	$pageBox.find('.search-item').each(function() {
		var $searchItem = $(this);
		var $btn = $searchItem.find('.btn');
		if($btn && $btn.length > 0) {//表单型查询条件：输入框input、下拉选择select......
			var $objs = $searchItem.find('[name]');
			for(var i=0; i<$objs.length; i++) {
				var paramName = $objs.eq(i).attr('name');
				var paramValue = $objs.eq(i).val();
				
				var tagType = $objs.eq(i).attr('type').toLowerCase();
				var isCheckboxOrRadio = (tagType == 'checkbox' || tagType == 'radio');
				if(paramValue != '' && (!isCheckboxOrRadio || $objs.eq(i).is(':checked'))) {
					params.push({name: paramName, value: paramValue});
				}
			}
		}
		else {
			var paramName = $searchItem.attr('name');
			var paramValue = $searchItem.find('span.active').attr('rel');
			if(paramValue && paramValue != '') {
				params.push({name: paramName, value: paramValue});
			}
		}
	});
	//获取请求路径
	var $searchUrl = $pageBox.find('.search-url');
	var url = $searchUrl.attr('url');
	var target = $searchUrl.attr('target');
	
	return {url: url, params: params, target: target};
}
/**
 * 获取分页信息
 * @param $pageBox jQuery对象
 * @param {Object} args {pageNum:"",pageSize:"",orderField:"",orderDirection:""}
 */
function _getPager($pageBox, args) {
	var result = [];
	
	var $pagination = $pageBox.find('.div-pagination .pager');
	if($pagination.length == 0)
		return result;
		
	//从分页条中获取分页信息
	var temp = {};
	var $pager = $pagination.children();
	for(var i=0; i<$pager.length; i++) {
		var name = $pager.eq(i).attr('name');
		var value = $pager.eq(i).val();
		temp[name] = value;
	}
	//解析参数args，重置分页信息
	if(args) {
		for(key in args) {
			if(key == 'pageNum') {
				temp[BSTP.pageInfo.pageNum] = args[key];
			}
			else if(key == 'pageSize') {
				temp[BSTP.pageInfo.pageSize] = args[key];
			}
			else if(key == 'orderField') {
				temp[BSTP.pageInfo.orderField] = args[key];
			}
			else if(key == 'orderDirection') {
				temp[BSTP.pageInfo.orderDirection] = args[key];
			}
		}
	}
	
	for(key in temp) {
		result.push({name: key, value: temp[key]});
	}
	return result;
}
/**
 * 处理分页和排序(级别)
 * options: {data: {分页参数}}, 分页参数{pageNum:"n", pageSize:"n", orderField:"xxx", orderDirection:""}
 * callback: 加载完成回调函数
 */
function _pageBreak($host, rel, options){
	var op = $.extend({ data:{pageNum:"", pageSize:"", orderField:"", orderDirection:""}, callback:null}, options);
	var $pageBox = $host.parents('.pageBox').eq(0);
	
	var params = [];
	var url;
	
	var $form = $pageBox.find('form.pager-form');
	if($form && $form.length > 0) {
		//获取查询条件、请求路径
		var temp = _getSearchFormParams($form);
		params = temp.params;
		url = temp.url;
	}
	else if($pageBox && $pageBox.length > 0) {
		//获取查询条件、请求路径
		var temp = _getSearchItemParams($pageBox);
		params = temp.params;
		url = temp.url;
		rel = temp.target;
	}
	params = params.concat(_getPager($pageBox, op.data));
	
	var $target;
	if(rel) {
		$target = $('#' + rel);
	}
	else {
		$target = $pageBox.parent();
	}
	$target.loadUrl(url, params, op.callback);
	return false;
}
/**
 * 处理分页和排序
 * @param obj 选择器
 */
function pageBreak(obj){
	var $this = $(obj);
	_pageBreak($this, {data: {pageSize: $this.val()}});
}

function ajaxTodo(url, params, callback){
	var $callback = callback || navTabAjaxDone;
	if (! $.isFunction($callback)) $callback = eval('(' + callback + ')');
	if(!params) {
		params = null;
	}
	BSTP.ajax('POST', url, params, $callback);
}
/**
 * ajax请求校验方法是否符合条件，符合则跳转到相应页面
 * @param url
 * @param forwardType 跳转类型，字符串，'self'/'blank'/'navTab'，默认为'navTab'
 * 		说明：'self'-当前窗口整体跳转, 'blank'-打开新窗口, 'navTab'-当前窗口的主体部分
 * @param options 参数：{params: {}, callback: null}, params为请求的参数，callback为请求成功并跳转后的处理操作
 */
function ajaxAndView(url, forwardType, options){
	var _types = ['self', 'blank', 'navTab'];
	var _callback = function(_url) {
		window.open(_url);
	}
	var _forwardType = forwardType || _types[2];
	if($.inArray(_forwardType, _types) == -1)
		return;
	
	var op = $.extend({params: {}, callback: null}, options);
	BSTP.ajax('GET', url, op.params, function(response){
		var json = BSTP.jsonEval(response);
		if (!json[BSTP.keys.statusCode])
			return;
		if (json[BSTP.keys.statusCode] == BSTP.statusCode.error){
			if (json[BSTP.keys.message]) 
				alertMsg.error(json[BSTP.keys.message]);
		} 
		else if (json[BSTP.keys.statusCode] == BSTP.statusCode.ok){
			if(_forwardType == _types[1])
				_callback(json.forwardUrl);
			else if(_forwardType == _types[2])
				navTab.openTab(json.forwardUrl);
			else if(_forwardType == _types[0])
				location.href = json.forwardUrl;
			
			if ($.isFunction(op.callback)) op.callback(response);
		}
		
		if (json[BSTP.keys.statusCode] == BSTP.statusCode.timeout){
			alertMsg.error(json[BSTP.keys.message] || BSTP.msg("sessionTimout"), {time: 0, yes:function(){
				BSTP.loadLogin();
			}});
		}
	});
}