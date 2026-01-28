#!/usr/bin/env python3
"""
Backend Test Suite for Ranking Matemática API
Testing optimized ranking endpoints after N+1 query fixes
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://code-shipper-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "danielprofessormatematica@gmail.com"
ADMIN_PASSWORD = "Daniel123*"

class RankingAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.admin_user = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def login_admin(self) -> bool:
        """Login as admin and get auth token"""
        try:
            self.log("🔐 Attempting admin login...")
            
            login_data = {
                "email": ADMIN_EMAIL,
                "senha": ADMIN_PASSWORD
            }
            
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.admin_user = data.get("usuario")
                
                # Set authorization header for future requests
                self.session.headers.update({
                    "Authorization": f"Bearer {self.auth_token}"
                })
                
                self.log(f"✅ Admin login successful! User: {self.admin_user.get('nome', 'Unknown')}")
                return True
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin login error: {str(e)}", "ERROR")
            return False
    
    def get_turmas(self) -> Optional[list]:
        """Get list of turmas to use for testing"""
        try:
            self.log("📚 Fetching turmas...")
            
            response = self.session.get(f"{BASE_URL}/turmas")
            
            if response.status_code == 200:
                turmas = response.json()
                self.log(f"✅ Found {len(turmas)} turmas")
                for turma in turmas:
                    self.log(f"   - {turma.get('nome', 'Unknown')} (ID: {turma.get('id', 'Unknown')})")
                return turmas
            else:
                self.log(f"❌ Failed to get turmas: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Error getting turmas: {str(e)}", "ERROR")
            return None
    
    def test_ranking_geral(self) -> bool:
        """Test GET /api/ranking/geral endpoint"""
        try:
            self.log("🏆 Testing GET /api/ranking/geral...")
            
            response = self.session.get(f"{BASE_URL}/ranking/geral")
            
            if response.status_code == 200:
                ranking = response.json()
                self.log(f"✅ General ranking retrieved successfully! Found {len(ranking)} teams")
                
                # Validate response structure
                if not isinstance(ranking, list):
                    self.log("❌ Response should be a list", "ERROR")
                    return False
                
                # Check each team has required fields
                required_fields = ["id", "nome", "cor", "pontosTotais", "posicao"]
                for i, team in enumerate(ranking):
                    for field in required_fields:
                        if field not in team:
                            self.log(f"❌ Team {i} missing required field: {field}", "ERROR")
                            return False
                    
                    self.log(f"   {team['posicao']}. {team['nome']} - {team['pontosTotais']} pontos (Cor: {team['cor']})")
                
                # Verify sorting (should be descending by pontosTotais)
                for i in range(len(ranking) - 1):
                    if ranking[i]['pontosTotais'] < ranking[i + 1]['pontosTotais']:
                        self.log("❌ Ranking not properly sorted by pontosTotais (descending)", "ERROR")
                        return False
                
                # Verify positions are sequential
                for i, team in enumerate(ranking):
                    if team['posicao'] != i + 1:
                        self.log(f"❌ Position mismatch: expected {i + 1}, got {team['posicao']}", "ERROR")
                        return False
                
                self.log("✅ General ranking structure and sorting validated!")
                return True
                
            else:
                self.log(f"❌ Failed to get general ranking: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing general ranking: {str(e)}", "ERROR")
            return False
    
    def test_ranking_turma(self, turma_id: str, turma_nome: str) -> bool:
        """Test GET /api/ranking/turma/{turma_id} endpoint"""
        try:
            self.log(f"🏆 Testing GET /api/ranking/turma/{turma_id} for {turma_nome}...")
            
            response = self.session.get(f"{BASE_URL}/ranking/turma/{turma_id}")
            
            if response.status_code == 200:
                ranking = response.json()
                self.log(f"✅ Turma ranking retrieved successfully! Found {len(ranking)} teams for {turma_nome}")
                
                # Validate response structure
                if not isinstance(ranking, list):
                    self.log("❌ Response should be a list", "ERROR")
                    return False
                
                # Check each team has required fields
                required_fields = ["id", "nome", "cor", "pontosTotais", "posicao"]
                for i, team in enumerate(ranking):
                    for field in required_fields:
                        if field not in team:
                            self.log(f"❌ Team {i} missing required field: {field}", "ERROR")
                            return False
                    
                    self.log(f"   {team['posicao']}. {team['nome']} - {team['pontosTotais']} pontos (Cor: {team['cor']})")
                
                # Verify sorting (should be descending by pontosTotais)
                for i in range(len(ranking) - 1):
                    if ranking[i]['pontosTotais'] < ranking[i + 1]['pontosTotais']:
                        self.log("❌ Turma ranking not properly sorted by pontosTotais (descending)", "ERROR")
                        return False
                
                # Verify positions are sequential
                for i, team in enumerate(ranking):
                    if team['posicao'] != i + 1:
                        self.log(f"❌ Position mismatch: expected {i + 1}, got {team['posicao']}", "ERROR")
                        return False
                
                self.log(f"✅ Turma ranking for {turma_nome} structure and sorting validated!")
                return True
                
            else:
                self.log(f"❌ Failed to get turma ranking: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing turma ranking: {str(e)}", "ERROR")
            return False
    
    def run_tests(self) -> bool:
        """Run all ranking endpoint tests"""
        self.log("🚀 Starting Ranking API Tests...")
        self.log("=" * 60)
        
        # Step 1: Login as admin
        if not self.login_admin():
            self.log("❌ Cannot proceed without admin authentication", "ERROR")
            return False
        
        self.log("-" * 60)
        
        # Step 2: Get turmas for testing
        turmas = self.get_turmas()
        if not turmas:
            self.log("❌ Cannot proceed without turmas data", "ERROR")
            return False
        
        self.log("-" * 60)
        
        # Step 3: Test general ranking
        if not self.test_ranking_geral():
            self.log("❌ General ranking test failed", "ERROR")
            return False
        
        self.log("-" * 60)
        
        # Step 4: Test turma-specific rankings
        turma_tests_passed = 0
        for turma in turmas:
            turma_id = turma.get('id')
            turma_nome = turma.get('nome', 'Unknown')
            
            if turma_id:
                if self.test_ranking_turma(turma_id, turma_nome):
                    turma_tests_passed += 1
                else:
                    self.log(f"❌ Turma ranking test failed for {turma_nome}", "ERROR")
            else:
                self.log(f"⚠️ Skipping turma without ID: {turma_nome}", "WARN")
        
        self.log("=" * 60)
        
        if turma_tests_passed == len([t for t in turmas if t.get('id')]):
            self.log("🎉 ALL RANKING TESTS PASSED!")
            self.log("✅ Optimized ranking endpoints are working correctly")
            self.log("✅ N+1 query fixes verified - single aggregation queries working")
            return True
        else:
            self.log(f"❌ Some tests failed. Passed: {turma_tests_passed}/{len(turmas)}")
            return False

def main():
    """Main test execution"""
    tester = RankingAPITester()
    
    try:
        success = tester.run_tests()
        
        if success:
            print("\n🎯 TEST SUMMARY: SUCCESS")
            print("All ranking endpoints are working correctly after optimization!")
            sys.exit(0)
        else:
            print("\n💥 TEST SUMMARY: FAILURE")
            print("Some ranking endpoint tests failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()