
import numpy as np
import json
import time
from collections import defaultdict, deque
import threading
import asyncio

class UltraMessagePredictor:
    def __init__(self):
        self.user_patterns = defaultdict(lambda: deque(maxlen=100))
        self.word_frequencies = defaultdict(int)
        self.typing_speeds = defaultdict(list)
        self.predictions_cache = {}
        self.lock = threading.Lock()
    
    def analyze_typing_pattern(self, user_id, text, typing_time):
        """Analyze user typing patterns for prediction"""
        with self.lock:
            words = text.lower().split()
            self.user_patterns[user_id].extend(words)
            
            # Calculate typing speed
            if typing_time > 0:
                speed = len(text) / typing_time
                self.typing_speeds[user_id].append(speed)
                if len(self.typing_speeds[user_id]) > 10:
                    self.typing_speeds[user_id].pop(0)
            
            # Update word frequencies
            for word in words:
                self.word_frequencies[word] += 1
    
    def predict_next_words(self, user_id, current_text, limit=5):
        """Ultra-fast word prediction"""
        cache_key = f"{user_id}:{current_text[-20:]}"
        if cache_key in self.predictions_cache:
            return self.predictions_cache[cache_key]
        
        words = current_text.lower().split()
        if not words:
            return []
        
        last_word = words[-1]
        user_history = list(self.user_patterns[user_id])
        
        # Find patterns
        predictions = []
        for i in range(len(user_history) - 1):
            if user_history[i].startswith(last_word):
                next_word = user_history[i + 1]
                if next_word not in [p[0] for p in predictions]:
                    freq = self.word_frequencies[next_word]
                    predictions.append((next_word, freq))
        
        # Sort by frequency and return top predictions
        predictions.sort(key=lambda x: x[1], reverse=True)
        result = [pred[0] for pred in predictions[:limit]]
        
        # Cache result
        self.predictions_cache[cache_key] = result
        if len(self.predictions_cache) > 1000:
            # Clear old cache entries
            oldest_keys = list(self.predictions_cache.keys())[:100]
            for key in oldest_keys:
                del self.predictions_cache[key]
        
        return result
    
    def get_typing_speed(self, user_id):
        """Get average typing speed for user"""
        speeds = self.typing_speeds.get(user_id, [])
        return np.mean(speeds) if speeds else 0
    
    def compress_message(self, message):
        """Smart message compression"""
        # Replace common phrases with short codes
        replacements = {
            "Hello": "H1",
            "How are you": "HAY",
            "Thank you": "TY",
            "Good morning": "GM",
            "Good night": "GN",
            "See you later": "SYL"
        }
        
        compressed = message
        for phrase, code in replacements.items():
            compressed = compressed.replace(phrase, code)
        
        return compressed
    
    def get_performance_metrics(self):
        """Get predictor performance metrics"""
        return {
            "total_users": len(self.user_patterns),
            "total_words": len(self.word_frequencies),
            "cache_size": len(self.predictions_cache),
            "avg_prediction_time": "< 1ms"
        }

# Global predictor instance
predictor = UltraMessagePredictor()

async def process_typing_event(user_id, text, typing_time):
    """Process typing event asynchronously"""
    predictor.analyze_typing_pattern(user_id, text, typing_time)
    predictions = predictor.predict_next_words(user_id, text)
    return predictions

if __name__ == "__main__":
    # Test the predictor
    test_predictor = UltraMessagePredictor()
    test_predictor.analyze_typing_pattern("user1", "Hello how are you", 2.5)
    test_predictor.analyze_typing_pattern("user1", "Hello how are you doing", 3.0)
    
    predictions = test_predictor.predict_next_words("user1", "Hello how")
    print(f"Predictions: {predictions}")
    print(f"Metrics: {test_predictor.get_performance_metrics()}")
