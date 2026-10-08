$(function() {
	//【选题卡】事件
	var $panelToggleBtn = $('.practice-panel .practice-panel-right div:last-child');
	var $panelContent = $panelToggleBtn.closest('.practice-panel').find('.practice-panel-item');
	$panelToggleBtn.click(function() {
		$panelContent.slideToggle();
	});
	$(document).on('click', function(e) {
		var ele = $panelContent;
		var ele2 = $panelToggleBtn;
		if(ele.is(':visible') && (!$(e.target)[0].isEqualNode(ele[0]) && ele.has(e.target).length === 0)
				&& (!$(e.target)[0].isEqualNode(ele2[0]) && ele2.has(e.target).length === 0)) {
			ele.slideUp();
		}
		e.stopPropagation();
//		return false;
	});
	
	//【面板试题】【上一题】【下一题】【确认答案】按钮事件
	$("body")
		.off('click', '.practice-panel .practice-panel-item span').on('click', '.practice-panel .practice-panel-item span', praxisNoClick)
		.off('click', '.practice .prevBtn').on('click', '.practice .prevBtn', praxisPrevClick)
		.off('click', '.practice .nextBtn').on('click', '.practice .nextBtn', praxisNextClick)
		.off('click', '.practice .confirmBtn').on('click', '.practice .confirmBtn', praxisTakeResult)
		.off('click', '.practice .practice-panel-right .collectBtn').on('click', '.practice .practice-panel-right .collectBtn', collectionAddOrRemove)
		.off('click', '.practice .practice-panel-right .removeBtn').on('click', '.practice .practice-panel-right .removeBtn', errorRemove)
		.off('click', '.practice .practice-panel-right .reportBtn').on('click', '.practice .practice-panel-right .reportBtn', errorReport)
		;
	
	//为解决初次加载时css未生效，采用定时器
	var sTimer = setTimeout(function() {
		praxisPanelLoad();
		praxisPanelInit();
		clearTimeout(sTimer);
	}, 0);
});

/**
 * 试题面板：按顺序加载试题，兼容【新的练习】和【继续上次的练习】
 */
function praxisPanelLoad() {
	$('.practice').show();
	$('.practice-result').hide();
	$('.practice-placeholder').hide();
	if(datas.praxisIds) {
		var arr;
		//是否随机模式
		var isRandom = $('.practice :hidden[name=type]').val() == 0 ? false : true;
		if(isRandom) {
			arr = praxisPanelCheck(datas.praxisIds, datas.practicePraxis);
		}
		else {
			arr = datas.praxisIds;
		}
		
		//选题卡加载内容
		var $panelItem = $('.practice-panel .practice-panel-item');
		$panelItem.empty();
		for(var i=0; i<arr.length; i++) {
			$panelItem.append('<span class="btn btn-default" rel="' + arr[i] + '">' + (i+1) + '</span>');
		}
		//题总数
		$('.practice-panel .practice-panel-left i:last-child').text(arr.length);
	}
}
/**
 * 试题面板：初始化用户练习的状态（自动移除已被删掉的试题）
 */
function praxisPanelInit() {
	//检查是否有试题
	var isPlaceholder = checkPlaceholder();
	if(isPlaceholder)
		return;
	
	var $panelItem = $('.practice-panel .practice-panel-item');
	var $last;//上次练习时停留的位置
	
	//类型：练习、我的错题、我的收藏
	var category = $('.practice :hidden[name=category]').val();
	if(category == 'practice') {
		//上次练习的详情
		var ptDetails = datas.practiceDetail;
		if(ptDetails) {
			//答题统计：正确数、错误数
			var countCorrect = 0, countWrong = 0;
			for(var i=0; i<ptDetails.length; i++) {
				var $item = $panelItem.find('span[rel=' + ptDetails[i].praxisId + ']');
				if($item && $item.length > 0) {
					//标识【试题】状态（做错的题绑定作答内容）
					if(ptDetails[i].answer) {
						$item.data('answer', ptDetails[i].answer);
						$item.addClass('wrong');
						countWrong++;
					}
					else {
						$item.addClass('correct');
						countCorrect++;
					}
				}
				$last = $item;
			}
			
			//答题统计
			$('.practice-panel .correct span').text(countCorrect);
			$('.practice-panel .wrong span').text(countWrong);
		}
	}
	
	if(category == 'practice' || category == 'error') {
		//初始化收藏标识
		var ptCollections = datas.collection;
		if(ptCollections) {
			for(var i=0; i<ptCollections.length; i++) {
				var $item = $panelItem.find('span[rel=' + ptCollections[i] + ']');
				if($item && $item.length > 0) {
					$item.data('collection', true);
				}
			}
		}
	}
	
	//继续上次的位置或者从头开始
	if($last && $last.length > 0) {
		var $next = $last.next();
		if($next && $next.length > 0) {
			$next.trigger('click');
		}
		else {
			$last.trigger('click');
		}
	}
	else {
		$panelItem.find('span:first-child').trigger('click');
	}
}
/**
 * 【随机模式】用户练习的题库顺序检查：题库有增减的情况
 * @param praxisIds 最新题库
 * @param ptOrder 用户上次练习的题库
 * @returns 本次练习的题库（顺序）
 */
function praxisPanelCheck(praxisIds, ptOrder) {
	var result;
	if(ptOrder && ptOrder.length > 0) {
		//题库检查【删减】：上次练习的题库与最新的题库做对比
		var temp = [];
		for(var i=0; i<ptOrder.length; i++) {
			if($.inArray(ptOrder[i], praxisIds) == -1) {
				temp.push(i);
			}
		}
		//移除被删掉的试题
		for(var i=0; i<temp.length; i++) {
			ptOrder.splice(temp[i], 1);
		}
		
		//题库检查【增添】：上次练习的题库与最新的题库做对比
		var temp2 = [];
		for(var i=0; i<praxisIds.length; i++) {
			if($.inArray(praxisIds[i], ptOrder) == -1) {
				temp2.push(praxisIds[i]);
			}
		}
		temp2.sort(BSTP.randomSort);
		result = ptOrder.concat(temp2);
	}
	else {
		result = praxisIds.sort(BSTP.randomSort);
	}
	return result;
}
function praxisPanelSlideUp() {
	$('.practice-panel .practice-panel-item').slideUp();
}
/**
 * 试题：题号点击事件
 */
function praxisNoClick() {
	var $this = $(this);
	if($this.hasClass('.selected'))
		return;
	var no = parseInt($(this).text());
	var praxisId = $this.attr('rel');
	praxisLoad(no, praxisId);
	praxisPanelSlideUp();
}
/**
 * 试题：加载/显示
 * @param no 题号
 */
function praxisLoad(no, praxisId) {
	var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
	if($item && $item.length > 0) {
		praxisShow(no, praxisId);
		praxisTakeShow(praxisId);
		praxisCollectionShow(praxisId);
	}
	else {
		var url = path + '/manage/practice/praxis';
		var pramas = {praxisId: praxisId};
		ajax(url, pramas, function(result) {
			praxisInit(result);
			praxisShow(no, praxisId);
			praxisCollectionShow(praxisId);
		}, null, null, null, 'html');
	}
}
/**
 * 试题：内容初始化，保存正确答案，（如果是已答过的）展示用户作答及结果
 * @param praxisHtml
 */
function praxisInit(praxisHtml) {
	var $target = $('#div-praxis-box');
	var $temp = $('<div>' + praxisHtml + '</div>');
	var $item = $temp.children('.div-item');
	if($item && $item.length > 0) {
		//对于填空题，不显示参考答案
		$item.find('input.text-entry').val('');
		$item.find('.item-score').remove();
		$item.appendTo($target);
		//单选、复选按钮iCheck化
		initICheck($item.find(':checkbox, :radio'));
		
		//答案处理，保存试题的正确答案
		var answers = [];
		var $answers = $temp.find('.div-item-answer p');
		for(var i=0; i<$answers.length; i++) {
			answers.push($answers.eq(i).text());
		}
		var praxisId = $item.attr('rel');
		$('.practice-panel .practice-panel-item span[rel=' + praxisId + ']').data('correctAnswer', answers);
		
		//显示判定结果
		praxisTakeShow(praxisId);
	}
}
/**
 * 试题：显示、面板项选中、当前进度设置
 * @param no 题号
 * @param praxisId 
 */
function praxisShow(no, praxisId) {
	$('.practice-panel .practice-panel-item span').removeClass('selected');
	$('.practice-panel .practice-panel-item span[rel=' + praxisId + ']').addClass('selected');
	$('.practice-panel .practice-panel-left i:first-child').text(no);
	$('#div-praxis-box > div').hide();
	var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
	if($item && $item.length > 0) {
		$item.show();
	}
	else {//试题不存在
		$('#div-praxis-box div.placeholder').show();
		praxisTakeHide();
		praxisHideCorrectAnswer();
	}
}
/**
 * 试题：作答结果判定
 */
function praxisTakeResult() {
	var $panelItem = $('.practice-panel .practice-panel-item span.selected');
	if($panelItem && $panelItem.length > 0) {
		var praxisId = $panelItem.attr('rel');
		var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
		if($item && $item.length > 0) {
			//试题题型、正确答案、用户答案
			var praxisType = $item.attr('type');
			var correctAnswers = $panelItem.data('correctAnswer');
			var userAnswers = [];
			var flag = true;
			
			//判定
			if(praxisType == 'SingleSelection' || praxisType == 'Judgement' || praxisType == 'MultipleSelection') {
				var $selections = $item.find('.item-selection :radio, .item-selection :checkbox');
				for(var i=0; i<$selections.length; i++) {
					if($selections.eq(i).is(':checked')) {
						userAnswers.push($selections.eq(i).val());
					}
					$selections.eq(i).iCheck('disable');
				}
				if(userAnswers.length > 0) {
					userAnswers.sort();
					correctAnswers.sort();
					var temp1 = userAnswers.join('');
					var temp2 = correctAnswers.join('');
					flag = temp1 == temp2 ? true : false;
				}
				else {
					flag = false;
				}
			}
			else if(praxisType == 'TextEntry') {
				var $inputs = $item.find('.item-title :text');
				for(var i=0; i<correctAnswers.length; i++) {
					var val = $.trim($inputs.eq(i).val());
					if(flag) {
						flag = flag & correctAnswers[i] == val;
					}
					userAnswers.push(val);
					$inputs.eq(i).attr('readonly');
				}
			}
			else if(praxisType == 'Composition') {
				var $textarea = $item.find('.item-content textarea');
				var val = $.trim($textarea.val());
				if(correctAnswers.length > 0) {//问答题可能没有正确答案，此时判定为正确
					var $p = $(correctAnswers[0]).find('p');
					if($p && $p.length > 0) {
						flag = $(correctAnswers[0]).text() == val;
					}
					else {
						flag = correctAnswers[0] == val;
					}
				}
				userAnswers.push(val);
			}
			
			//结果处理
			if(flag) {
				praxisTakeCorrect();
				$panelItem.removeClass('wrong').addClass('correct');
				resetCount(true);
			} 
			else {
				praxisTakeWrong();
				$panelItem.removeClass('correct').addClass('wrong');
				$panelItem.data('answer', userAnswers);
				resetCount(false);
			}
			praxisLoadCorrectAnswer(praxisId);
			//如果做错的话，则添加到错题集（已存在则错误次数加1）
			if(!flag) {
				errorAdd(praxisId);
			}
			
			//如果是题库练习的话，则记录练习详情到后台
			var category = $('.practice :hidden[name=category]').val();
			if(category == 'practice') {
				practiceSubmit();
			}
			else {
				//自动跳到下一题
				setTimeout(praxisNextClick, 1000);
			}
		}
	}
}
/**
 * 试题：作答结果正确
 * @param praxisId
 */
function praxisTakeCorrect() {
	var $operation = $('.practice .practice-main .operation > div:first-child');
	$operation.empty().show();
	$operation.append('<span><i class="success"></i>您的答案是正确的！</span>');
}
/**
 * 试题：作答结果错误
 * @param praxisId
 */
function praxisTakeWrong() {
	var $operation = $('.practice .practice-main .operation > div:first-child');
	$operation.empty().show();
	$operation.append('<span><i class="error"></i>您的答案是错误的！</span>');
}
/**
 * 试题：作答结果初始(确认答案按钮)
 * @param praxisId
 */
function praxisTakeInit() {
	var $operation = $('.practice .practice-main .operation > div:first-child');
	$operation.empty().show();
	$operation.append('<button class="btn btn-white-blue confirmBtn">确认</button>');
}
/**
 * 试题：作答结果及操作栏隐藏
 */
function praxisTakeHide() {
	$('.practice-main .operation').hide();
}
/**
 * 试题：显示正误信息
 * @param praxisId
 * @returns
 */
function praxisTakeShow(praxisId) {
	var $panelItem = $('.practice-panel .practice-panel-item span[rel=' + praxisId + ']');
	//如果已作答过，则反显用户作答、结果、正确答案
	if($panelItem.hasClass('correct') || $panelItem.hasClass('wrong')) {
		praxisLoadUserAnswer(praxisId);
		praxisLoadCorrectAnswer(praxisId);
		if($panelItem.hasClass('correct')) {
			praxisTakeCorrect();
		}
		else {
			praxisTakeWrong();
		}
	}
	else {
		praxisHideCorrectAnswer();
		praxisTakeInit();
	}
}
/**
 * 试题：变更收藏标识
 * @param praxisId
 */
function praxisCollectionShow(praxisId) {
	var category = $('.practice :hidden[name=category]').val();
	if(category == 'collection') {
		return;
	}
	var $collection = $('.practice .practice-panel-right .collectBtn');
	var $panelItem = $('.practice-panel .practice-panel-item span[rel=' + praxisId + ']');
	var isCollection = $panelItem.data('collection');
	if(isCollection) {
		$collection.removeClass('star').addClass('onstar');
		$collection.find('span').text('取消收藏');
	}
	else {
		$collection.removeClass('onstar').addClass('star');
		$collection.find('span').text('收藏');
	}
}
/**
 * 重置对错统计信息
 */
function resetCount(isCorrect) {
	if(isCorrect) {
		var $correct = $('.practice .practice-panel-right .correct span');
		$correct.text(parseInt($correct.text()) + 1);
	}
	else {
		var $correct = $('.practice .practice-panel-right .wrong span');
		$correct.text(parseInt($correct.text()) + 1);
	}
}
/**
 * 试题：加载用户作答的答案
 * @param praxisId
 */
function praxisLoadUserAnswer(praxisId) {
	var $panelItem = $('.practice-panel .practice-panel-item span[rel=' + praxisId + ']');
	var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
	if($panelItem && $panelItem.length > 0 && $item && $item.length > 0) {
		var userAnswers = $panelItem.data('answer');
		var correctAnswers = $panelItem.data('correctAnswer');
		var temp = userAnswers ? userAnswers : correctAnswers;
		
		//反显用户答案
		var praxisType = $item.attr('type');
		if(praxisType == 'SingleSelection' || praxisType == 'Judgement' || praxisType == 'MultipleSelection') {
			$item.find('.item-selection :radio, .item-selection :checkbox').each(function() {
				var $this = $(this);
				if($.inArray($this.val(), temp) != -1) {
					$this.iCheck('check');
				}
				$this.iCheck('disable');
			});
		}
		else if(praxisType == 'TextEntry') {
			$item.find('.item-title :text').each(function(i) {
				var $this = $(this);
				$this.val(temp[i]);
				$this.attr('readonly', 'readonly');
			});
		}
		else if(praxisType == 'Composition') {
			$item.find('.item-content textarea').each(function(i) {
				var $this = $(this);
				$this.val(temp[i]);
				$this.attr('readonly', 'readonly');
			});
		}
	}
}
/**
 * 试题：加载正确答案
 * @param praxisId
 */
function praxisLoadCorrectAnswer(praxisId) {
	var $panelItem = $('.practice-panel .practice-panel-item span[rel=' + praxisId + ']');
	var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
	if($panelItem && $panelItem.length > 0) {
		var correctAnswers = $panelItem.data('correctAnswer');
		
		//展示正确答案
		var praxisType = $item.attr('type');
		var $answers = $('.practice .practice-answers > div');
		$answers.empty();
		$answers.parent().show();
		for(var i=0; i<correctAnswers.length; i++) {
			if(praxisType == 'MultipleSelection') {
				var $p = $answers.children('p');
				if($p && $p.length > 0) {
					$p.text($p.text() + correctAnswers[i]);
				}
				else {
					$answers.append('<p>' + correctAnswers[i] + '</p>');
				}
			}
			else {
				$answers.append('<p>' + correctAnswers[i] + '</p>');
			}
		}
	}
}
function praxisHideCorrectAnswer() {
	$('.practice .practice-answers div').empty();
	$('.practice .practice-answers').hide();	
}
/** 试题：【下一题】点击事件 */
function praxisNextClick() {
	var $active = $('.practice-panel .practice-panel-item span.selected');
	if($active && $active.length > 0) {
		var $next = $active.next();
		if($next && $next.length > 0) {
			$next.trigger('click');
		}
		else {
			toResult();
		}
	}
}
/** 试题：【上一题】点击事件 */
function praxisPrevClick() {
	var $active = $('.practice-panel .practice-panel-item span.selected');
	if($active && $active.length > 0) {
		var $prev = $active.prev();
		if($prev && $prev.length > 0) {
			$prev.trigger('click');
		}
	}
}
/**
 * 试题：作答信息提交到后台
 */
function practiceSubmit() {
	var data = getPracticeData();
	if(data.content.length == 0) {
		return;
	}
	
	var url = path + '/manage/practice/addPractice';
	var subjectId = $('.practice :hidden[name=subjectId]').val();
	var type = $('.practice :hidden[name=type]').val();
	var params = {
		praxis: JSON.stringify(data.praxis), 
		content: JSON.stringify(data.content),
		subjectId: subjectId,
		type: type
	};
	ajax(url, params, practiceSubmitCallback);
}
function practiceSubmitCallback(result) {
	if(result.statusCode == BSTP.statusCode.ok) {
		//自动跳到下一题
		setTimeout(praxisNextClick, 500);
	}
	/*
	else {
		alertMsg.error('记录练习情况失败！');
	}
	*/
}
/**
 * 练习结果页
 */
function toResult() {
	$('.practice').hide();
	$('.practice-placeholder').hide();
	var $result = $('.practice-result');
	var count = getPracticeCount();
	$result.find('li:eq(0) span').text(count.correct);
	$result.find('li:eq(1) span').text(count.wrong);
	$result.find('li:eq(2) span').text(count.undo);
	$result.show();
}
/**
 * 检查是否是试题，没有则显示无内容
 */
function checkPlaceholder() {
	var $panelItems = $('.practice .practice-panel-item').children();
	if($panelItems.length == 0) {
		$('.practice').hide();
		$('.practice-result').hide();
		$('.practice-placeholder').show();
		return true;
	}
	return false;
}
/**
 * 返回练习页
 */
function toPractice() {
	$('.practice').show();
	$('.practice-result').hide();
	
	var $panel = $('.practice .practice-panel-item');
	var $itemActive = $panel.find('span.selected');
	if(!$itemActive || $itemActive.length == 0) {
		var $first = $panel.find('span:first-child');
		if($first && $first.length > 0) {
			$first.trigger('click');
		}
	}
}
/**
 * 重新练习
 */
function rePractice() {
	var url = path + '/manage/practice/clearPractice';
	var subjectId = $('.practice :hidden[name=subjectId]').val();
	var type = $('.practice :hidden[name=type]').val();
	var params = {subjectId: subjectId, type: type};
	ajax(url, params, function(result) {
		redirect(result.forwardUrl);
	});
}
/**
 * 获取当前练习的数据
 * @returns {Object}，praxis: 试题ID数组（按顺序）, content: 作答详情，格式为{praxisId: 试题ID, answer: [错误的作答]}
 */
function getPracticeData() {
	//本次练习的题库（按顺序）
	var praxisIds = [];
	//做过的试题
	var taked = [];
	//当前正在作答的试题数据，添加在数组的最后，以标识作答位置
	var dataActive;
	
	var $items = $('.practice-panel .practice-panel-item').children();
	for(var i=0; i<$items.length; i++) {
		var praxisId = $items.eq(i).attr('rel');
		praxisIds.push(praxisId);
		
		if($items.eq(i).hasClass('correct') || $items.eq(i).hasClass('wrong')) {
			var data = {praxisId: praxisId};
			if($items.eq(i).hasClass('wrong')) {
				data.answer = $items.eq(i).data('answer');
			}
			if($items.eq(i).hasClass('selected')) {
				dataActive = data;
				continue;
			}
			taked.push(data);
		}
	}
	if(dataActive && dataActive.praxisId) {
		taked.push(dataActive);
	}
	
	return {praxis: praxisIds, content: taked};
}
/**
 * 获取统计数据
 */
function getPracticeCount() {
	var result = {correct: 0, wrong: 0, undo: 0};
	var $panel = $('.practice .practice-panel-item');
	var total = $panel.children().length;
	result.correct = $panel.children('span.correct').length;
	result.wrong = $panel.children('span.wrong').length;
	result.undo = total - result.correct - result.wrong;
	return result;
}
/**
 * 错题集：添加
 * @param praxisId
 */
function errorAdd(praxisId) {
	var url = path + '/manage/practice/addError';
	ajax(url, {praxisId: praxisId}, null);
}
/**
 * 错题集：移除
 */
function errorRemove() {
	var $itemActice = $('.practice .practice-panel-item span.selected');
	if($itemActice && $itemActice.length > 0) {
		praxisId = $itemActice.attr('rel');
		var url = path + '/manage/practice/removeError';
		ajax(url, {praxisId: praxisId}, function(result) {
			if(result.statusCode == BSTP.statusCode.ok) {
				praxisRemove(praxisId);
			}
			else {
				alertMsg.error('移除错题失败！');
			}
		});
	}
}
/**
 * 收藏：添加或移除
 */
function collectionAddOrRemove() {
	var $itemActice = $('.practice .practice-panel-item span.selected');
	if($itemActice && $itemActice.length > 0) {
		var praxisId = $itemActice.attr('rel');
		var params = {praxisId: praxisId};
		var $this = $(this);
		if($this.hasClass('star')) {
			var url = path + '/manage/practice/addCollection';
			ajax(url, params, function(result) {
				if(result.statusCode == BSTP.statusCode.ok) {
					$itemActice.data('collection', true);
					praxisCollectionShow(praxisId);
				}
				else {
					alertMsg.error('收藏失败！');
				}
			});
		}
		else if($this.hasClass('onstar')) {
			var url = path + '/manage/practice/removeCollection';
			ajax(url, params, function(result) {
				if(result.statusCode == BSTP.statusCode.ok) {
					//类型：练习、我的错题、我的收藏
					var category = $('.practice :hidden[name=category]').val();
					if(category != 'collection') {
						$itemActice.data('collection', false);
						praxisCollectionShow(praxisId);
					}
					else {
						praxisRemove(praxisId);
					}
				}
				else {
					alertMsg.error('取消收藏失败！');
				}
			});
		}
	}
}
/**
 * 页面中删除某试题
 */
function praxisRemove(praxisId) {
	var $item = $('#div-praxis-box .div-item[rel=' + praxisId + ']');
	$item.remove();
	
	var $panelItem = $('.practice .practice-panel-item span[rel=' + praxisId + ']');
	var $panelItemNext = $panelItem.next();
	
	$panelItem.remove();
	var $panelItems = $('.practice .practice-panel-item span');
	$panelItems.each(function(i) {
		$(this).text(i + 1);
	});
	//题总数、正确数、错误数
	$('.practice-panel .practice-panel-left i:last-child').text($panelItems.length);
	resetCount(true);
	resetCount(false)
	
	var isPlaceholder = checkPlaceholder();
	if(isPlaceholder) {
		return;
	}
	else {
		if($panelItemNext && $panelItemNext.length > 0) {
			$panelItemNext.trigger('click');
		}
		else {
			toResult();
		}
	}
}
/**
 * 删除试题按钮点击事件
 */
function praxisRemoveClick() {
	var category = $('.practice :hidden[name=category]').val();
	if(category == 'practice') {
		var $itemActive = $('.practice .practice-panel-item span.selected');
		if($itemActive && $itemActive.length > 0) {
			var praxisId = $itemActive.attr('rel');
			praxisRemove(praxisId);
		}
	}
	else if(category == 'error') {
		errorRemove();
	}
	else if(category == 'collection') {
		collectionAddOrRemove();
	}
}
/**
 * 试题纠错按钮点击事件
 */
function errorReport() {
	var $itemActice = $('.practice .practice-panel-item span.selected');
	if($itemActice && $itemActice.length > 0) {
		var praxisId = $itemActice.attr('rel');
		var url = path + '/manage/praxis/error?id=' + praxisId;
		$.pdialog.open(url, 'praxis_error', '试题纠错', {area: ['600px', '270px']});
	}
}
