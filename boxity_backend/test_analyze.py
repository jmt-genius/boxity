import unittest
import json
import base64
import os
import sys

# Add the directory containing the app to the path so we can import it
sys.path.append(os.getcwd())

from api.index import app

class TestAnalyzeEndpoint(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

        # Create a simple 1x1 pixel black image
        self.small_image = base64.b64encode(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82').decode('utf-8')
        self.valid_b64 = f"data:image/png;base64,{self.small_image}"

    def test_analyze_pair_valid(self):
        """Test analyzing a single pair of images (2-step flow part 1)."""
        payload = {
            "baseline": self.valid_b64,
            "current": self.valid_b64
        }
        response = self.app.post('/analyze', 
                                 data=json.dumps(payload), 
                                 content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['aggregate_tis'], 100) # Should be perfect match
        self.assertIn('differences', data)
        self.assertIn('can_upload', data)
        self.assertTrue(data['can_upload'])

    def test_normalization_failure_repro(self):
        """Try to trigger normalization failed with empty/bad images if possible, 
        or at least verify how it handles garbage data."""
        
        # Sending non-image data as base64 might cause open failures or cv2 decoding failures
        garbage_b64 = "data:image/png;base64,VGhpcyBpcyBub3QgYW4gaW1hZ2U=" 
        
        payload = {
            "baseline": garbage_b64,
            "current": self.valid_b64
        }
        response = self.app.post('/analyze', 
                                 data=json.dumps(payload), 
                                 content_type='application/json')
        
        # We expect it might fail 500 or handle it gracefully. 
        # If the bug exists, it might crash or print "Normalization Failed" and return 500.
        print(f"\n[Normalization Repro] Status: {response.status_code}")
        # data = json.loads(response.data)
        # print(f"[Normalization Repro] Response: {data}")

    def test_analyze_two_angles(self):
        """Test the 4-image flow."""
        payload = {
            "baseline_angle1": self.valid_b64,
            "current_angle1": self.valid_b64,
            "baseline_angle2": self.valid_b64,
            "current_angle2": self.valid_b64
        }
        response = self.app.post('/analyze', 
                                 data=json.dumps(payload), 
                                 content_type='application/json')
        self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()
