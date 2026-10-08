(function($) {
	
	$.fn.extend({
		/**
		 * 列表组轮播化
		 * @param showCont：正整数，每屏显示的个数
		 * @param isFullScreen：true/false，是否整屏翻页，false时每次翻一个
		 */
		xSlider: function(showCont, isFullScreen) {
			//初始化
			var $this = $(this);
			var _left = $this.children().eq(0).outerWidth(true);
			var _num = $this.children().length;
			
			$this.addClass('x-slider-list').wrap('<div class="x-slider-view"></div>');
			$this.parent().wrap('<div class="x-slider"></div>');
			var $host = $this.parent().parent();
			var $operator = $('<div class="x-slider-opeartor"><span class="left"></span><span class="right"></span></div>').prependTo($host);
			$host.css('width', showCont * _left + 'px');
			if(_num > showCont) {
				$operator.find('.right').show();
			}
			
			var j = 0;
			var i = 1;
			var hostData = {i: i, j: j, left: _left * showCont, num: _num};
			if(isFullScreen) {
				hostData.left = _left * showCont;
				hostData.num = parseInt(_num / showCont);
			}
			else {
				hostData.left = _left;
				hostData.num = _num - showCont;
			}
			
			$operator.find('.left').bind('click', {hostData: hostData}, function(event) {
				var $parent = $(this).closest('.x-slider');
				var $list = $parent.find('.x-slider-list');
				var $oper = $parent.find('.x-slider-opeartor');
				
				event.data.hostData.j--;
				event.data.hostData.i--;
				if (event.data.hostData.j <= event.data.hostData.num) {
					$list.animate({
						left : "-" + event.data.hostData.left * event.data.hostData.j + "px"
					});
				}
				if (event.data.hostData.i <= event.data.hostData.num) {
					$oper.find('.right').show();
				}
				if (event.data.hostData.j < 1) {
					$oper.find('.left').hide();
				}
			});
			$operator.find('.right').bind('click', {hostData: hostData}, function(event) {
				var $parent = $(this).closest('.x-slider');
				var $list = $parent.find('.x-slider-list');
				var $oper = $parent.find('.x-slider-opeartor');
			
				event.data.hostData.j++;
				event.data.hostData.i++;
				if (event.data.hostData.j <= event.data.hostData.num) {
					$list.animate({
						left : "-" + event.data.hostData.left * event.data.hostData.j + "px"
					});
				}
				if (event.data.hostData.i > event.data.hostData.num) {
					$oper.find('.right').hide();
				}
				if (event.data.hostData.j > 0) {
					$oper.find('.left').show();
				}
			});
		}	
	});
})(jQuery);