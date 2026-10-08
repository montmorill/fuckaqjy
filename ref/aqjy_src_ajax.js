function ajax(url, params, success, timeout, error, context, dataType) {
	var options = {
		type : 'POST',
		url : url,
		data : params,
		dataType : (dataType == null || $.trim(dataType) == '' ? 'json' : dataType),
		cache : false,
//		global: false, 
		success : function(result)
				{
					if(success)
						success.call(context, result);
				}
	};
	if (error)
		options.error = error;
	else
		options.error = defaultError;
	if (timeout)
		options.timeout = timeout;
	if(context)
		options.context = context;
	jQuery.ajax(options);
}

function defaultError(XMLHttpRequest, textStatus, errorThrown)
{
	var msg = '';
	var status = XMLHttpRequest.status;
	switch(status)
	{
		case 404:
			msg = strings.ajax_error_404;
			break;
		case 500:
			msg = strings.ajax_error_500;
			break;
	}
	if(msg != '')
	{
		alertMsg.error(msg);
	}
	return false;
}