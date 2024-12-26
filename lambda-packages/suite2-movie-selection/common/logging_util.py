import json
import logging
import traceback
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class LambdaLogger:
    def __init__(self, function_name: str, event: Dict[str, Any]):
        self.function_name = function_name
        self.request_id = None
        if 'requestContext' in event:
            self.request_id = event['requestContext'].get('requestId')
        
    def _format_log(self, level: str, message: str, extra: Optional[Dict] = None) -> Dict:
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': level,
            'function': self.function_name,
            'message': message
        }
        
        if self.request_id:
            log_data['request_id'] = self.request_id
            
        if extra:
            log_data.update(extra)
            
        return log_data
        
    def info(self, message: str, extra: Optional[Dict] = None):
        log_entry = self._format_log('INFO', message, extra)
        logger.info(json.dumps(log_entry))
        
    def error(self, message: str, error: Optional[Exception] = None, extra: Optional[Dict] = None):
        error_data = extra or {}
        if error:
            error_data.update({
                'error_type': error.__class__.__name__,
                'error_message': str(error),
                'stacktrace': traceback.format_exc()
            })
        log_entry = self._format_log('ERROR', message, error_data)
        logger.error(json.dumps(log_entry))
        
    def warn(self, message: str, extra: Optional[Dict] = None):
        log_entry = self._format_log('WARN', message, extra)
        logger.warning(json.dumps(log_entry))

def init_logger(function_name: str, event: Dict[str, Any]) -> LambdaLogger:
    """Initialize a new logger for Lambda function use"""
    return LambdaLogger(function_name, event)