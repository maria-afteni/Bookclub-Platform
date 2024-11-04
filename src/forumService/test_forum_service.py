import unittest
from unittest.mock import patch, MagicMock
from flask import json
from forumService.forumService import app 

class ForumServiceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    @patch('forumService.requests.post')
    def test_register_service(self, mock_post):
        mock_post.return_value.status_code = 200 

        response = self.app.get('/status')
        self.assertEqual(response.status_code, 200)
        self.assertIn('running', str(response.data))

    @patch('forumService.discussions_collection.insert_one')
    def test_create_discussion(self, mock_insert):
        mock_insert.return_value.inserted_id = 'test_thread_id'
        
        response = self.app.post('/discussions', json={
            'title': 'New Discussion',
            'author': 'User2',
            'content': 'This is a test discussion.'
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Discussion thread created successfully')
        self.assertEqual(data['thread_id'], 'test_thread_id')

    def test_create_discussion_missing_fields(self):
        response = self.app.post('/discussions', json={
            'title': 'New Discussion',
            'author': 'User2'
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'Missing required fields')

if __name__ == '__main__':
    unittest.main()
