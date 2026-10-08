/** 资源处理按钮(下载或在线播放多媒体) */
function resourceClickHandler(){
	var $this = $(this);
	if($this.hasClass('disabled'))
		return;
	var $tr = $this.parents('tr').eq(0);
	var filePath = $tr.find('input[name="path"]').val();
	
	
	/*
	 * 视频播放配置：中途弹出试题、首次播放不允许快进、播放完成进行记录
	 * @time 2021-01-12
	 */
	var playerSetting = {};
	var resourceId = parseInt($tr.attr('rel'));
	var detail = $tr.closest('table').data('detail');
	var praxis = $tr.data('praxis');
	var setting = $tr.find('span.video-rate').text().trim() == '100%';
	if(!setting) {
		var tempPraxis = [];
		if (praxis) {
			tempPraxis = JSON.parse(praxis);
		}
		var tempDetail = [];
		if(detail) {
			tempDetail = JSON.parse(detail);
		}
		if(!setting) {
			playerSetting.isCanFast = false;
			playerSetting.timeLeftAsEnd = 10;
			playerSetting.time = function(time, duration) {
				for(var i=0; i<tempPraxis.length; i++) {
					if(tempPraxis[i].second === time) {
						//弹出试题
						var url = path + '/manage/practice/praxis';
						var pramas = {praxisId: tempPraxis[i].praxisIds[0]};
						BSTP.ajax(null, url, pramas, function(result) {
							var $temp = $('<div>' + result + '</div>');
							var $tempItem = $temp.children('.div-item');
							if($tempItem && $tempItem.length > 0) {
								var html = 
									'<div>' + $temp.html() + '</div>' + 
									'<div class="form-bar">' + 
										'<div class="fl"></div>' + 
										'<button class="btn btn-primary fr" onclick="coursePraxisTakeResult(this)">确定</button>' + 
									'</div>';
								var dialogId = 'resourcePraxis';
								$.pdialog.open(null, dialogId, '答个题，休息一下......', {
									move: false,
									closeBtn: 0, 
									shadeClose: false, 
									area: ['680px', '500px'],
									content: html,
									success: function() {
										//弹出成功后视频暂停播放
										player.videoPause();
										
										var $div = $('#' + dialogId);
										var $item = $div.find('.div-item');
										//对于填空题，不显示参考答案
										$item.find('input.text-entry').val('');
										$item.find('.item-score').remove();
										//答案处理，保存试题的正确答案
										var answers = [];
										var $answers = $temp.find('.div-item-answer p');
										for(var i=0; i<$answers.length; i++) {
											answers.push($answers.eq(i).text());
										}
										$item.data('correctAnswer', answers);
										$div.find('.div-item-answer').remove();
										//单选、复选按钮iCheck化
										initICheck($div.find(':checkbox, :radio'));
									}
								});
							}
						}, null, null, null, 'html');
						break;
					}
				}
			};
			playerSetting.end = function() {
				var traineeId = $(':hidden[name=traineeId]').val();
				var trainingContentId = $('.div-course.active').attr('rel');
				var url = path + '/manage/learn/updateDetail';
				var params = {traineeId: traineeId, trainingContentId: trainingContentId, resourceId: resourceId};
				BSTP.ajax(null, url, params, function(result) {
					if(result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
						$('#div_list_detail table').data('detail', result.data.detail);
					}
				});
			};
		}
	}

	var fileType = $tr.find('input[name="type"]').val();
	var fileFormat = filePath.substring(filePath.indexOf('.') + 1).toLowerCase();
	if(('1' == fileType && fileFormat != 'pdf') || '7' == fileType) {
		var url = path + '/manage/resource/download?filePath=' + filePath;
		window.location.href = url;
	}
	// 播放视频
	else if ('4' === fileType && fileFormat === 'mp4') {
		videoView(filePath, $this, playerSetting);
	}
	else {
		//调用/resource/view.js里的方法
		xFileView(filePath, null, true, null, playerSetting);
	}
	//标记该行
	$tr.addClass('active');
	$tr.siblings().removeClass('active');
	
	//启动计时器（倒计时）
	timerStart();

	// 视频未播放完不向后端传记录
	if('4' == fileType && fileFormat == 'mp4'){
		return;
	}
	//向后台记录已学习的资源
	learned($this);
}

/** 向后台记录已学习的资源 */
var learned = function($this) {
	var $table = $this.closest('table');
	var trainingState = $table.attr('state');
	if(trainingState === '1') {
		var url = path + '/manage/learn/learned';
		var params = {
			trainingContentId: $this.closest('table').attr('rel'),
			traineeId: traineeId,
			resourceId: $this.closest('tr').attr('rel')
		};
		BSTP.ajax(null, url, params, function(result) {
			if(result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
				var unlearned = result.data.unlearned;
				var rate = result.data.rate;
				if(unlearned.length === 0) {
					var $btn = $('#div_list_detail .form-bar .btn');
					$btn.removeClass('btn-gray').addClass('btn-orange contentComplete');
					$btn.bind('click', courseCompleteClickHandler);
				}
				// 更新资源的完成进度(视频显示的是百分比)
				var trim = $this.closest('tr').find('td').eq(1).text().trim();
				var type = trim.substring(trim.lastIndexOf('.'));
				if (type == '.mp4') {
					// 视频
					$this.closest('tr').find('td').eq(2).find('.video-rate').empty().html(rate + '%');
				}

			}
		});
	}
}

/** 查询已学习视频时长 */
function videoView(filePath, $this, playerSetting) {
	var url = path + '/manage/learn/viewingTime';
	var trainingContentId = $this.closest('table').attr('rel');
	var resourceId = $this.closest('tr').attr('rel');
	var params = {trainingContentId: trainingContentId, traineeId: traineeId, resourceId: resourceId};
	BSTP.ajax(null, url, params, function (result) {
		if (result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
			var recordParams = {};
			//是否需要记录
			recordParams.isRecord = result.data.isRecord;
			//后台记录的已学习时长
			recordParams.viewingTime = result.data.viewingTime;
			if(recordParams.isRecord){
				//后台记录学习时长url
				recordParams.url = path + '/manage/learn/record';
				//请求参数
				recordParams.requestParam = {};
				recordParams.requestParam.trainingContentId = trainingContentId;
				recordParams.requestParam.traineeId = traineeId;
				recordParams.requestParam.resourceId = resourceId;
				//视频播放完成后回调函数
				recordParams.callbackParam = $this;
				recordParams.callback = learned;
			}
			xFileView(filePath, null, true, null, playerSetting, recordParams);
		}
	});
}

/**
 * 视频播放中弹窗试题：答题结果确认
 */
function coursePraxisTakeResult(ele) {
	var $this = $(ele);
	var $item = $this.parent().parent().find('.div-item');
	if($item && $item.length > 0) {
		//试题题型、正确答案、用户答案
		var praxisType = $item.attr('type');
		var correctAnswers = $item.data('correctAnswer');
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
		var $result = $this.parent().find('div');
		if(flag) {
			$result.html('<span><i class="success"></i>您的答案是正确的！</span>');
			//自动关闭，视频继续播放
			setTimeout(function() {
				$.pdialog.closeCurrent();
				player.videoPlay();
			}, 1000);
		} 
		else {
			$result.html('<span><i class="error"></i>正确答案：' + correctAnswers.toString().replaceAll(',', '') +'</span>');
			$this.replaceWith('<button class="btn btn-primary btn-close fr" onclick="player.videoPlay();">关闭</button>');
		}
	}
}
/** 课程学完点击事件 */
function courseCompleteClickHandler(){
	alertMsg.confirm("确定已学完？", {
		okCall : function() {
			var trainingContentId = $('.div-course.active').attr('rel');
			var traineeId = $(':hidden[name=traineeId]').val();
			var url = path + '/manage/learn/updateStatus';
			var params = {trainingContentId: trainingContentId, traineeId: traineeId, status: 1};
			ajax(url, params, updateStatusCallBack);
		},
		cancelCall : function() {
		}
	});
}
//学习改变按钮回调函数
function updateStatusCallBack(result){
	if(result.statusCode == 200){
		var $bar = $('#div_list_detail div.form-bar');
		$bar.empty();
		$bar.append('<button class="btn btn-gray" type="button">已学完</button>');
	} else{
		alertMsg.error(result.message);
	}
}
/** 开始测验 */
function startTrainingTest(e){
	if($(e).attr("disabled")!="disabled"){
		var trainingContentId = $('.div-course.active').attr('rel');
		var traineeId = $(':hidden[name=traineeId]').val();
		var url = path + '/manage/quiz/check';
		var options = {};
		options.params = {trainingContentId: trainingContentId, traineeId: traineeId};
		options.callback = function() {
			$(e).attr("disabled","disabled");
		};
		ajaxAndView(url, 'blank', options);
	}
}
/** 课程详细内容列表内容初始化 */
function detailListInit() {
	var $list_detail = $('#div_list_detail');
	var $btns = $list_detail.find('.table .btn');
	var $btn_complete = $list_detail.find('.btn.contentComplete');

	//学习资源下载或播放、课程学完点击事件
	if($btns && $btns.length > 0) {
		$btns.bind('click', resourceClickHandler);
	}
	if($btn_complete && $btn_complete.length > 0) {
		$btn_complete.bind('click', courseCompleteClickHandler);
	}

	/*
	 * 视频处理：完成情况、试题配置，显式变为隐式
	 * @time 2021-01-12
	 */
	$list_detail.find('table tbody tr').each(function() {
		var $this = $(this);
		var praxis = $this.attr('praxis');
		if(praxis && praxis.length > 0) {
			$this.data('praxis', praxis);
		}
		$this.removeAttr('praxis');

		var $table = $this.closest('table');
		var detail = $table.attr('detail');
		if(detail && detail.length > 0) {
			$table.data('detail', detail);
		}
		$table.removeAttr('detail');
	});
}
/** 培训内容点击事件：展示详情 */
function detailClick(){
	var $host = $(this);
	var trainingContentId = $host.attr('rel');
	var traineeId = $(':hidden[name=traineeId]').val();
	var params = {trainingContentId: trainingContentId, traineeId: traineeId};
	$('#div_list_detail').loadUrl(path + '/manage/learn/contentDetail', params, function(result) {
		$('div.div-course').removeClass('active');
		$host.addClass('active');
		
		detailListInit();
		//最少学习时长、已学时长、倒计时等
		var learnTime = $host.attr('time');
		if(learnTime && learnTime.length > 0 && parseInt(learnTime) > 0) {
			$('.content-info').show();
			$('.content-info .content-learn-time').text(learnTime);
			
			timerEnd();
			
			var $time = $('#div_list_detail .btn.contentComplete i');
			if($time && $time.length > 0) {
				var rest = parseInt(learnTime) - parseInt($time.attr('used'));
				rest = rest * 60;
				$time.text(timeFormat(rest));
				$time.attr('rest', rest);
				// $time.parent().attr('disabled', 'disabled');
			}
		}
		else {
			$('.content-info').hide();
			$('.content-info .content-learn-time').empty();
		}
	});
}
/**
 * 更新已学时长
 */
function updateLearnedTime() {
	var $rest = $('#div_list_detail .btn.contentComplete i');
	var learnTime = $('.div-course.active').attr('time');	//最少学习时长：分钟
	var rest = $rest.attr('rest');							//剩余时间：秒
	var used = parseInt(learnTime) - parseInt(rest) / 60;	//已学时间：分钟
	var trainingContentId = $('.div-course.active').attr('rel');
	var traineeId = $(':hidden[name=traineeId]').val();
	
	var url = path + '/manage/learn/updateUsedTime';
	var params = {trainingContentId: trainingContentId, traineeId: traineeId, usedTime: used};
	ajaxTemp(url, params, function(result) {
		if(result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
			if(result.data.usedTime) {
				rest = (learnTime - result.data.usedTime) * 60;
				if(rest === 0) {
					timerEnd();
				}
				else {
					$rest.text(timeFormat(rest));
					$rest.attr('rest', rest);
				}
			}
		}
	});
}
/**
 * 倒计时（剩余带学时长）：启动
 */
function timerStart() {
	var $time = $('#div_list_detail .btn.contentComplete i');
	if($time && $time.length > 0) {
		var tempRest = $time.attr('rest');
		if(tempRest && parseInt(tempRest) > 0 && !timerRest) {
			timerRest = setInterval(function() {
				var rest = $('#div_list_detail .btn.contentComplete i').attr('rest');
				rest = parseInt(rest);
				rest = rest - 1;
				$time.text(timeFormat(rest));
				$time.attr('rest', rest);
				
				if(rest % 60 === 0) {
					updateLearnedTime();
				}
				if(rest === 0) {
					timerEnd();
				}
			}, 1000);
		} else if (timerRest) {
		} else {
			timerEnd();
		}
	}
}
/**
 * 倒计时（剩余带学时长）：结束
 */
function timerEnd() {
	if(timerRest) {
		clearInterval(timerRest);
		timerRest = null;
	}

	var $time = $('#div_list_detail .btn.contentComplete i');
	if($time && $time.length > 0) {
		$time.empty();
		$time.removeAttr('rest');
		// $time.parent().removeAttr('disabled');
	}
}
/**
 * 学习时间记录特定的ajax请求<br>
 * 注：屏蔽掉了全局的ajax事件，采用静默请求，出错时界面也无感知
 */
function ajaxTemp(url, params, success, timeout, error, context) {
	var options = {
		type: 'POST',
		url: url,
		data: params,
		cache: false,
		global: false,
		success: function(result){
			if(success) {
				var json = BSTP.jsonEval(result);
				if(json[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
					success.call(context, result);
				}
				else {
					console.log('====记录学习状态与时间出错！');
				}
			}
		}
	};
	if (error)
		options.error = error;
	else {
		options.error = function() {
			console.log('====记录学习状态与时间出错！');
		};
	}
	if (timeout)
		options.timeout = timeout;
	if(context)
		options.context = context;
	jQuery.ajax(options);
}
/**
 * 时间格式化：时、分
 */
function timeFormat(intSecond) {
	var mm = parseInt(intSecond / 60);
	var ss = parseInt(intSecond % 60);
	mm < 10 ? mm = '0' + mm : mm;
	ss < 10 ? ss = '0' + ss : ss;
	return mm + ":" + ss;
}
//计时器
var timerRest;
$(function() {
	clearInterval(timerRest);
	timerRest = null;

	//为解决初次加载时css未生效，采用定时器
	var sTimer = setTimeout(function() {
		//培训内容轮播展示
		$('.list_content').xSlider(5, true);
		//培训内容点击事件绑定
		$('.div-course').bind('click', detailClick);
		$('.div-course').eq(0).trigger('click');
		clearTimeout(sTimer);
	}, 100);
});