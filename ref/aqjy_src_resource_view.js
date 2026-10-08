$(function() {
	//图片预览插件fancybox清理（因为页面是局部加载，而fancybox的html是追加在body的最后，fancybox初始化时会出错）（需在fanxybox.js引入之前）
	fancyboxClean();
});
/**
 * 多媒体文件预览/播放
 * @param filePath {String} 文件路径（相对路径）
 * @param $container {jQuery对象}
 * @param isRecordTime {boolean} 视频是否自动续播
 * @param fileDocId {String} 第三方预览服务生成的文档ID
 * @param recordParams {} 培训课程资源学习记录
 */
function xFileView(filePath, $container, isRecordTime, fileDocId, firstSetting, recordParams) {
	//允许的格式
	var allowedFormat = {
		image: ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
		office: ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'],
		pdf: ['pdf'],
		video: ['mp4'],
		swf: ['swf'],
		unity: ['unity3d', 'html']
	};
	var serverPath = xFileViewServerPath + '/resource';
	
	//文件扩展名
	var fileFormat = filePath.substring(filePath.lastIndexOf('.') + 1);
	fileFormat = fileFormat.toLowerCase();
	
	if(allowedFormat.image.indexOf(fileFormat) != -1) {
		xfileViewImage(filePath, serverPath, $container);
	}
	else if(allowedFormat.pdf.indexOf(fileFormat) != -1) {
		xfileViewPdf(filePath, serverPath, $container, fileDocId);
	}
	else if(allowedFormat.video.indexOf(fileFormat) != -1) {
		xfileViewVideo(filePath, serverPath, $container, isRecordTime, firstSetting, recordParams);
	}
	else if(allowedFormat.swf.indexOf(fileFormat) != -1) {
		xfileViewSwf(filePath, serverPath, $container);
	}
	else if(allowedFormat.office.indexOf(fileFormat) != -1) {
		xfileViewOffice(filePath, serverPath, $container, fileDocId);
	}
	else if(allowedFormat.unity.indexOf(fileFormat) != -1) {
		xfileViewUnity(filePath, serverPath, $container);
	}
}
/**
 * 多媒体文件预览/播放：图片预览
 * @param filePath
 * @param serverPath
 * @param $container
 */
function xfileViewImage(filePath, serverPath, $container) {
	var url = serverPath + filePath;
	var html = '<img src="' + url + '" />';
	
	if($container && $container.length > 0) {//非弹窗
		$container.html(html);
	}
	else {
		/*
		$.pdialog.open(null, null, '', {
			title: false,
			shadeClose: true,
			area: ['auto','auto'],
			content: html
		});
		*/
		$.fancybox({href : url, overlayColor: '#000', overlayOpacity: 0.3});
	}
}
/**
 * 多媒体文件预览/播放：动画
 * @param filePath
 * @param serverPath
 * @param $container
 */
function xfileViewSwf(filePath, serverPath, $container) {
	var url = serverPath + filePath;
	var html = '<embed src="' + url + '" type="application/x-shockwave-flash" width="100%" height="100%"></embed>';
	
	if($container && $container.length > 0) {//非弹窗
		$container.html(html);
	}
	else {
		$.pdialog.open(null, null, '', {
			title: false,
			shadeClose: true,
			content: html
		});
	}
}
/**
 * 多媒体文件预览/播放：unity3d播放
 * @param filePath
 * @param serverPath
 */
function xfileViewU3d(filePath, serverPath, $container) {
	var url = serverPath + filePath;
	
	if($container && $container.length > 0) {//非弹窗
		$container.html(html);
	}
	else {
		window.open(url);
	}
}
/**
 * 多媒体文件预览/播放：pdf预览
 * @param filePath
 * @param serverPath
 * @param $container {jQuery对象} 容器，为空时表示弹窗
 */
function xfileViewPdf(filePath, serverPath, $container) {
	var _getHtml = function(isHasCloseBtn) {
		var html = 
			'<div class="pdf-view">' + 
				'<div class="pdf-view-warp"></div>' + 
				(isHasCloseBtn ? '<div class="pdf-view-icon pdf-view-remove btn-close"><i class="icon-remove"></i></div>' : '') + 
				/*
				'<div class="pdf-view-icon pdf-view-plus"><i class="icon-plus"></i></div>' + 
				'<div class="pdf-view-icon pdf-view-minus"><i class="icon-minus"></i></div>' + 
				*/
			'</div>';
		return html;
	};
	var _show = function($container) {
		var pdfUrl = serverPath + filePath;
		var options = {
			url: pdfUrl, 
			pluginsPath: path + '/s/pdf', 
			scale: 1.5, 
			render: $container.find('.pdf-view .pdf-view-warp'),
			pageSize: 5
		};
		new XPdfViewer(options);
	};
	
	if($container && $container.length > 0) {//非弹窗
		$container.html(_getHtml(false));
		_show($container);
	}
	else {
		$.pdialog.open(null, null, '', {
			title: false,
			closeBtn: 0, 
			shadeClose: true, 
			area: ['100%', '100%'],
			content: _getHtml(true),
			success: function() {
				var dom = $.pdialog.getCurrent();
				_show($(dom));
			}
		});
	}
}

/**
 * 多媒体文件预览/播放：视频播放
 * @param filePath
 * @param serverPath 
 * @param $container {jQuery对象} 容器，为空时表示弹窗
 * @param isRecordTime {boolean} 是否记录播放位置
 * @param firstSetting {Object} 第一次播放的配置，格式如下：
 * 		  {
 * 			isCanFast: true,					//是否可以快进（向前拖动等）
 * 			timeLeftAsEnd: 5,					//剩余多少秒时等同于播放结束（即触发播放结束事件）
 * 			time: function(time, duration) {},	//播放时间的处理函数，带有2个参数，time当前播放的秒数，duration总时长
 * 			end: function() {}					//播放结束的处理函数
 * 		  }
 */
var player;
function xfileViewVideo(filePath, serverPath, $container, isRecordTime, firstSetting, recordParams) {
	//div随机ID
	var rand = Math.ceil(Math.random() * 10000);
	var videoId = 'video' + rand;
	var html = '<div id="' + videoId + '" class="x-video" style="height: 100%;"></div>';

	//后台是否需要记录播放时长
	var isRecord = recordParams && recordParams.isRecord;
	//定时器
	var recordInterval = -1;

	var _show = function() {
		var videoPath = serverPath + filePath;
		//视频资源暂时从阿里云来获取（需要把视频上传到阿里云）
		//var videoPath = 'http://oss.rainier.com.cn/resource' + filePath;
		var videoOptions = {
				container: '#'+videoId,			//容器的ID或class
				volume: 0.5,
				variable: 'player',				//该属性必需设置，值等于下面的new chplayer()的对象
				flashplayer: false,				//如果强制使用flashplayer则设置成true
				video: videoPath				//视频地址
		};
		
		//创建播放器
		player = new ckplayer(videoOptions);
		
		//播放器原设置
		var originalTimeScheduleAdjust = player.ckplayerConfig.config.timeScheduleAdjust;
		var originalFastNext = player.fastNext;
		var originalPlaybackRateArr = player.playbackRateArr;
		
		//是否可快进
		var isCanFast = true;
		if(firstSetting && firstSetting.isCanFast != undefined && !firstSetting.isCanFast){
			isCanFast = false;
	        //不能向前拖动进度条
	        player.ckplayerConfig.config.timeScheduleAdjust = 3;
	        //控制pc右向键盘不能快进
	        player.fastNext = function () {};
	        //不能倍速播放
	        player.playbackRateArr = [[1, '正常']];
		}
		//恢复可快进
		var _resetFast = function() {
			if(!isCanFast) {
				isCanFast = true;
	            player.ckplayerConfig.config.timeScheduleAdjust = originalTimeScheduleAdjust;
	            player.fastNext = originalFastNext;
	            player.playbackRateArr = originalPlaybackRateArr;
			}
		};
		var _ended = function() {
			//后台记录播放时长
			if (isRecord) {
				var params = $.extend(recordParams.requestParam, {
					viewingTime: player.getMetaDate().duration,
					totalTime: player.getMetaDate().duration
				});
				BSTP.ajax(null, recordParams.url, params, function (result) {
					if (result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
						if (recordInterval != -1) {
							window.clearInterval(recordInterval);
							recordInterval = -1;
						}
						console.info('后台记录学习时长定时器结束');
						//执行回调
						if(recordParams.callback && $.isFunction(recordParams.callback)){
							recordParams.callback(recordParams.callbackParam);
						}
					}
				});
			}
			localStorage.removeItem(lsKey);

			// if(isRecordTime) {
			// 	var playingRecord = localStorage.getItem(lsKey);
			// 	if(playingRecord != null) {
			// 		playingRecord = JSON.parse(playingRecord);
			// 		delete playingRecord[filePath];
			// 		if(Object.keys(playingRecord).length > 0) {
			// 			localStorage.setItem(lsKey, JSON.stringify(playingRecord));
			// 		}
			// 		else {
			// 			localStorage.removeItem(lsKey);
			// 		}
			// 	}
			// }
			//自定义函数
			if(!isCanFast && firstSetting && firstSetting.end && $.isFunction(firstSetting.end)) {
				firstSetting.end();
				//恢复可快进
				_resetFast();
			}
		};
		
		//h5本地存储的key值
		var lsKey = 'PlayingRecord';
		//是否已续播
		var isAutoSeek = false;
		//视频结束监听
		player.addListener('ended', _ended);
		//视频时间监听
		player.addListener('time', function(t) {
			//时间间隔1s以上才有效
			var $video = $('#' + videoId);
			var tempLastTime = $video.data('lastTime');
			if(tempLastTime && Math.abs(t - tempLastTime) < 1) {
				return;
			} 
			$video.data('lastTime', t);
			
			var time = Math.floor(t);
			var duration = player.getMetaDate().duration;//总时长（秒）
			if(isRecordTime) {
				var playingRecord = localStorage.getItem(lsKey);
				if(playingRecord == null) {
					playingRecord = {};
				}
				else {
					playingRecord = JSON.parse(playingRecord);
				}
				playingRecord[filePath] = time;
				localStorage.setItem(lsKey, JSON.stringify(playingRecord));
			}
			//自定义函数
			if(!isCanFast && firstSetting && firstSetting.time && $.isFunction(firstSetting.time)) {
				firstSetting.time(time, duration);
			}
			if(!isCanFast && firstSetting.timeLeftAsEnd && /^\d+$/.test(firstSetting.timeLeftAsEnd)) {
				if(firstSetting.timeLeftAsEnd === Math.floor(duration - time)) {
					_ended();
				}
			}
		});
		//视频缓冲监听
		player.addListener('play', function() {
			if(isRecordTime) {
				if(isAutoSeek) 
					return;
				//播放记录
				var playingRecord = localStorage.getItem(lsKey);
				//判断播放记录是否存在
				if(playingRecord != null) {
					playingRecord = JSON.parse(playingRecord);
					if(playingRecord[filePath] != null && playingRecord[filePath] > 0) {
						//自动续播
						player.videoSeek(playingRecord[filePath]);
						layer.msg('已为您自动续播');
					}
				}
				//后台记录播放时长大于0
				else if (isRecord && recordParams.viewingTime > 0) {
					playingRecord = {};
					playingRecord.time = recordParams.viewingTime;
					playingRecord.path = filePath;
					localStorage.setItem(lsKey, JSON.stringify(playingRecord));
					//自动续播
					player.videoSeek(playingRecord.time);
					layer.msg('已为您自动续播');
				}
				isAutoSeek = true;

				//后台记录学习时长定时器
				if (isRecord && recordInterval === -1) {
					recordInterval = window.setInterval(function () {
						var params = $.extend(recordParams.requestParam, {
							viewingTime: Math.floor(player.time),
							totalTime: player.getMetaDate().duration
						});
						BSTP.ajax(null, recordParams.url, params, function (result) {
							if (result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
								console.info('后台记录已学习时长:' + player.time);
							}
						});
					}, 600000);
				}
			}
		});
		
		//存储player，用于播放器清除
		$('#' + videoId).data('player', player);
	};
	var _clear = function($target) {
		var $video = $target.find('.x-video');
		if($video && $video.length > 0) {
			var tempPlayer = $video.data('player');
			if(tempPlayer) {
				tempPlayer.videoClear();
				tempPlayer.V = {
					buffered: '', 
					pause: function(){}
				};
			}
		}
	};
	
	if($container && $container.length > 0) {//非弹窗
		_clear($container);
		$container.html(html);
		_show();
	}
	else {
		$.pdialog.open(null, null, '', {
			title: false,
			area: ['650px', '420px'], 
			content: html,
			success: function() {
				$.pdialog._videoSuccess($.pdialog.getCurrent());
				_show();
			},
			// cancel: function(index, layero) {
			// 	_clear($(layero));
			// }
			cancel: function(){
				if (isRecord && recordInterval > 0) {
					window.clearInterval(recordInterval);
					var params = $.extend(recordParams.requestParam, {
						viewingTime: Math.floor(player.time),
						totalTime: player.getMetaDate().duration
					});
					BSTP.ajax(null, recordParams.url, params, function (result) {
						if (result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
							var recordRate = result.data.rate;
							var $this = recordParams.callbackParam;
							$this.closest('tr').find('td').eq(2).find('.video-rate').empty().html(recordRate + '%');
						}
					});
				}
			}
		});
	}
}
/**
 * 多媒体文件预览/播放：视频播放
 * @param filePath {String} 文件路径（相对路径）
 * @param serverPath 
 * @param $container {jQuery对象} 容器，为空时表示弹窗
 * @param fileDocId {String} 第三方预览服务生成的文档ID
 */
function xfileViewOffice(filePath, serverPath, $container, fileDocId) {
	//第三方预览服务的URL
	var urlAPI = 'http://tumu.ncwu.owvlab.net';
	var urlAPIDoc = '/openapi/wpsonlinefile';
	var urlAPIView = '/openapi/wps/view/';
	
	var _show = function(viewUrl) {
		if($container && $container.length > 0) {//非弹窗
			var html = '<iframe src="' + viewUrl + '" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>';
			$container.html(html);
		}
		else {
			$.pdialog.open(viewUrl, null, '预览', {
				type: 2,
				area: ['100%', '100%']
			});
		}
	};
	
	//第三方预览服务：最终的URL
	var url = '';
	if(fileDocId && fileDocId.length > 0) {
		url = urlAPI + urlAPIView + fileDocId;
		_show(url);
	}
	else {
		url = path + '/manage/resource/view/document';
		var params = {filePath: filePath, urlAPI: urlAPI + urlAPIDoc};
		BSTP.ajax(null, url, params, function(result) {
			if(result[BSTP.keys.statusCode] == BSTP.statusCode.ok) {
				fileDocId = result.data.docId;
				if(fileDocId && fileDocId.length > 0) {
					url = urlAPI + urlAPIView + fileDocId;
					console.log('====获取文档ID成功：' + fileDocId);
					_show(url);
				}
			}
			else {
				console.log('====获取文档ID失败！');
				return;
			}
		});
	}
}
/**
 * 多媒体文件预览/播放：unity3d播放
 * @param filePath
 * @param serverPath
 * @param $container
 */
function xfileViewUnity(filePath, serverPath, $container) {
	var url;	
	if(filePath.endsWith('index.html')) {//WebGL
		url = serverPath + filePath;
	}
	else {//Unity3D
		url = basePath + '/manage/resource/view/unity?filePath=' + filePath;
	}
	
	if($container && $container.length > 0) {//非弹窗
		var html = '<iframe src="' + url + '" scrolling="no" frameborder="0"></iframe>';
		$container.html(html);
	}
	else {
		window.open(url, '_blank');
	}
}
/**
 * 图片预览插件fancybox清理（因为页面是局部加载，而fancybox的html是追加在body的最后，fancybox初始化时会出错）（需在fanxybox.js引入之前）
 */
function fancyboxClean() {
	$('div#fancybox-tmp').remove();
	$('div#fancybox-loading').remove();
	$('div#fancybox-overlay').remove();
	$('div#fancybox-wrap').remove();
}