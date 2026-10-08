$('.navbar-personal > a:first').click(function() {
	$(this).next().find('a').eq(0).trigger('click');
});

$(function() {
	//统计用户未读消息数量
	var url = path + '/manage/userMessage/countUnRead';
	ajax(url, null, function(result) {
		var $host = $('header .navbar-personal > a');
		if(result.data.unReadMessage > 0) {
			$host.find('img').after('<span class="unread"></span>');
		}
		else {
			$host.find('span.unread').remove();
		}
	});
});

$(function() {
	 $(".navbar-operation").mouseover(function(){
		 $(".navbar-operation").parent().addClass("navbar-operationhover");
	 });
	 $(".navbar-operation").mouseout(function(){
		 $(".navbar-operation").parent().removeClass("navbar-operationhover");
	 })
});