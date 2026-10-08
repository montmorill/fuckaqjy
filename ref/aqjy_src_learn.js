//标题、按钮点击事件
function learContentClickHandler(){
	var trainingId = $(this).parents('.list-group-item').eq(0).attr('rel');
	var url = path + "/manage/learn/check?trainingId=" + trainingId + '&forwardIndex=false';
	ajaxAndView(url);
}

$(function() {
	$('.list-group-me .list-group-item .btn').bind('click', learContentClickHandler);
	$('.list-group-me .list-group-item .course-title, .list-group-me .list-group-item img').bind('click', learContentClickHandler);
});