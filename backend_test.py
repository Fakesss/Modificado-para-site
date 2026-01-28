#!/usr/bin/env python3
"""
Backend Test Suite for Lixeira (Soft Delete) Functionality
Tests the trash/soft delete system for conteudos and exercicios
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://code-shipper-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "danielprofessormatematica@gmail.com"
ADMIN_PASSWORD = "Daniel123*"

class LixeiraTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_conteudo_id = None
        self.test_exercicio_id = None
        self.results = {
            "login": False,
            "soft_delete_conteudos": False,
            "soft_delete_exercicios": False,
            "api_lixeira_listar": False,
            "api_lixeira_restaurar": False,
            "api_lixeira_deletar_permanente": False,
            "api_lixeira_limpar_expirados": False
        }
        self.errors = []

    def log_error(self, test_name, error):
        """Log an error for a specific test"""
        error_msg = f"[{test_name}] {error}"
        self.errors.append(error_msg)
        print(f"❌ {error_msg}")

    def log_success(self, test_name, message=""):
        """Log a successful test"""
        self.results[test_name] = True
        success_msg = f"[{test_name}] SUCCESS"
        if message:
            success_msg += f" - {message}"
        print(f"✅ {success_msg}")

    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        kwargs['headers'] = headers
        
        try:
            response = self.session.request(method, url, **kwargs)
            return response
        except Exception as e:
            return None

    def test_admin_login(self):
        """Test admin login and get authentication token"""
        print("\n🔐 Testing Admin Login...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "senha": ADMIN_PASSWORD
        }
        
        response = self.make_request('POST', '/auth/login', json=login_data)
        
        if not response:
            self.log_error("login", "Failed to connect to server")
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('access_token')
            if self.token:
                self.log_success("login", f"Token obtained for user: {data.get('usuario', {}).get('nome', 'Unknown')}")
                return True
            else:
                self.log_error("login", "No access token in response")
        else:
            self.log_error("login", f"Login failed with status {response.status_code}: {response.text}")
        
        return False

    def test_get_conteudos(self):
        """Get existing conteudos"""
        print("\n📚 Getting existing conteudos...")
        
        response = self.make_request('GET', '/conteudos')
        
        if not response or response.status_code != 200:
            self.log_error("get_conteudos", f"Failed to get conteudos: {response.status_code if response else 'No response'}")
            return []
        
        conteudos = response.json()
        print(f"📊 Found {len(conteudos)} existing conteudos")
        return conteudos

    def test_create_conteudo(self):
        """Create a test conteudo for testing"""
        print("\n➕ Creating test conteudo...")
        
        test_data = {
            "tipo": "VIDEO",
            "titulo": f"Test Conteudo - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "descricao": "Conteúdo criado para teste da funcionalidade de lixeira",
            "urlVideo": "https://www.youtube.com/watch?v=test123",
            "ordem": 999,
            "abaCategoria": "videos"
        }
        
        response = self.make_request('POST', '/conteudos', json=test_data)
        
        if not response or response.status_code != 200:
            self.log_error("create_conteudo", f"Failed to create conteudo: {response.status_code if response else 'No response'}")
            return None
        
        conteudo = response.json()
        self.test_conteudo_id = conteudo.get('id')
        print(f"✅ Created test conteudo with ID: {self.test_conteudo_id}")
        return conteudo

    def test_soft_delete_conteudo(self):
        """Test soft delete of conteudo"""
        print("\n🗑️ Testing soft delete of conteudo...")
        
        if not self.test_conteudo_id:
            # Try to get existing conteudos
            conteudos = self.test_get_conteudos()
            if conteudos:
                self.test_conteudo_id = conteudos[0]['id']
            else:
                # Create one for testing
                conteudo = self.test_create_conteudo()
                if not conteudo:
                    self.log_error("soft_delete_conteudos", "No conteudo available for testing")
                    return False
        
        # Delete the conteudo (should be soft delete)
        response = self.make_request('DELETE', f'/conteudos/{self.test_conteudo_id}')
        
        if not response or response.status_code != 200:
            self.log_error("soft_delete_conteudos", f"Failed to delete conteudo: {response.status_code if response else 'No response'}")
            return False
        
        result = response.json()
        if "lixeira" in result.get("message", "").lower():
            self.log_success("soft_delete_conteudos", "Conteudo moved to trash")
            return True
        else:
            self.log_error("soft_delete_conteudos", f"Unexpected delete message: {result.get('message')}")
            return False

    def test_conteudo_not_in_list(self):
        """Verify deleted conteudo doesn't appear in regular list"""
        print("\n🔍 Verifying conteudo is not in regular list...")
        
        conteudos = self.test_get_conteudos()
        
        # Check if our deleted conteudo is still in the list
        for conteudo in conteudos:
            if conteudo.get('id') == self.test_conteudo_id:
                self.log_error("soft_delete_conteudos", "Deleted conteudo still appears in regular list")
                return False
        
        print("✅ Deleted conteudo correctly filtered from regular list")
        return True

    def test_get_lixeira(self):
        """Test getting items from trash"""
        print("\n🗂️ Testing lixeira listing...")
        
        response = self.make_request('GET', '/admin/lixeira')
        
        if not response or response.status_code != 200:
            self.log_error("api_lixeira_listar", f"Failed to get lixeira: {response.status_code if response else 'No response'}")
            return []
        
        items = response.json()
        print(f"📊 Found {len(items)} items in trash")
        
        # Check if our deleted conteudo is in the trash
        found_conteudo = False
        for item in items:
            if item.get('id') == self.test_conteudo_id and item.get('tipo') == 'CONTEUDO':
                found_conteudo = True
                print(f"✅ Found deleted conteudo in trash: {item.get('titulo')}")
                print(f"   Days remaining: {item.get('dias_restantes')}")
                break
        
        if found_conteudo:
            self.log_success("api_lixeira_listar", "Deleted conteudo found in trash")
        else:
            self.log_error("api_lixeira_listar", "Deleted conteudo not found in trash")
        
        return items

    def test_restore_conteudo(self):
        """Test restoring conteudo from trash"""
        print("\n♻️ Testing conteudo restoration...")
        
        response = self.make_request('POST', f'/admin/lixeira/{self.test_conteudo_id}/restaurar?tipo=CONTEUDO')
        
        if not response or response.status_code != 200:
            self.log_error("api_lixeira_restaurar", f"Failed to restore conteudo: {response.status_code if response else 'No response'}")
            return False
        
        result = response.json()
        if "restaurado" in result.get("message", "").lower():
            self.log_success("api_lixeira_restaurar", "Conteudo restored successfully")
            return True
        else:
            self.log_error("api_lixeira_restaurar", f"Unexpected restore message: {result.get('message')}")
            return False

    def test_conteudo_back_in_list(self):
        """Verify restored conteudo is back in regular list"""
        print("\n🔍 Verifying conteudo is back in regular list...")
        
        conteudos = self.test_get_conteudos()
        
        # Check if our restored conteudo is back in the list
        for conteudo in conteudos:
            if conteudo.get('id') == self.test_conteudo_id:
                print("✅ Restored conteudo is back in regular list")
                return True
        
        self.log_error("api_lixeira_restaurar", "Restored conteudo not found in regular list")
        return False

    def test_permanent_delete(self):
        """Test permanent deletion from trash"""
        print("\n💀 Testing permanent deletion...")
        
        # First, delete the conteudo again to put it back in trash
        print("   Deleting conteudo again to put in trash...")
        response = self.make_request('DELETE', f'/conteudos/{self.test_conteudo_id}')
        
        if not response or response.status_code != 200:
            self.log_error("api_lixeira_deletar_permanente", "Failed to delete conteudo for permanent deletion test")
            return False
        
        # Now permanently delete it
        print("   Permanently deleting from trash...")
        response = self.make_request('DELETE', f'/admin/lixeira/{self.test_conteudo_id}?tipo=CONTEUDO')
        
        if not response or response.status_code != 200:
            self.log_error("api_lixeira_deletar_permanente", f"Failed to permanently delete: {response.status_code if response else 'No response'}")
            return False
        
        result = response.json()
        if "permanentemente" in result.get("message", "").lower():
            self.log_success("api_lixeira_deletar_permanente", "Conteudo permanently deleted")
            return True
        else:
            self.log_error("api_lixeira_deletar_permanente", f"Unexpected permanent delete message: {result.get('message')}")
            return False

    def test_conteudo_completely_gone(self):
        """Verify conteudo is completely gone"""
        print("\n🔍 Verifying conteudo is completely gone...")
        
        # Check regular list
        conteudos = self.test_get_conteudos()
        for conteudo in conteudos:
            if conteudo.get('id') == self.test_conteudo_id:
                self.log_error("api_lixeira_deletar_permanente", "Permanently deleted conteudo still in regular list")
                return False
        
        # Check trash
        trash_items = self.test_get_lixeira()
        for item in trash_items:
            if item.get('id') == self.test_conteudo_id:
                self.log_error("api_lixeira_deletar_permanente", "Permanently deleted conteudo still in trash")
                return False
        
        print("✅ Conteudo completely removed from system")
        return True

    def test_cleanup_expired(self):
        """Test cleanup of expired items"""
        print("\n🧹 Testing cleanup of expired items...")
        
        response = self.make_request('POST', '/admin/lixeira/limpar-expirados')
        
        if not response or response.status_code != 200:
            self.log_error("api_lixeira_limpar_expirados", f"Failed to cleanup expired items: {response.status_code if response else 'No response'}")
            return False
        
        result = response.json()
        conteudos_removed = result.get('conteudos_removidos', 0)
        exercicios_removed = result.get('exercicios_removidos', 0)
        
        self.log_success("api_lixeira_limpar_expirados", f"Cleanup completed - {conteudos_removed} conteudos, {exercicios_removed} exercicios removed")
        return True

    def test_exercicio_soft_delete(self):
        """Test soft delete functionality for exercicios"""
        print("\n📝 Testing exercicio soft delete...")
        
        # First get existing exercicios
        response = self.make_request('GET', '/exercicios')
        if not response or response.status_code != 200:
            self.log_error("soft_delete_exercicios", "Failed to get exercicios")
            return False
        
        exercicios = response.json()
        
        if not exercicios:
            # Create a test exercicio
            test_data = {
                "titulo": f"Test Exercicio - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "descricao": "Exercício criado para teste da funcionalidade de lixeira",
                "modoCriacao": "MANUAL",
                "habilidadesBNCC": ["EF06MA01"],
                "pontosPorQuestao": 1,
                "questoes": [
                    {
                        "numero": 1,
                        "tipoResposta": "MULTIPLA_ESCOLHA",
                        "enunciado": "Teste: 2 + 2 = ?",
                        "alternativas": [
                            {"letra": "A", "texto": "3", "cor": "#E74C3C"},
                            {"letra": "B", "texto": "4", "cor": "#27AE60"},
                            {"letra": "C", "texto": "5", "cor": "#3498DB"}
                        ],
                        "correta": "B",
                        "pontuacaoMax": 1,
                        "habilidadesBNCC": ["EF06MA01"]
                    }
                ]
            }
            
            response = self.make_request('POST', '/exercicios', json=test_data)
            if not response or response.status_code != 200:
                self.log_error("soft_delete_exercicios", "Failed to create test exercicio")
                return False
            
            exercicio = response.json()
            self.test_exercicio_id = exercicio.get('id')
        else:
            self.test_exercicio_id = exercicios[0]['id']
        
        # Delete the exercicio (should be soft delete)
        response = self.make_request('DELETE', f'/exercicios/{self.test_exercicio_id}')
        
        if not response or response.status_code != 200:
            self.log_error("soft_delete_exercicios", f"Failed to delete exercicio: {response.status_code if response else 'No response'}")
            return False
        
        result = response.json()
        if "lixeira" in result.get("message", "").lower():
            self.log_success("soft_delete_exercicios", "Exercicio moved to trash")
            return True
        else:
            self.log_error("soft_delete_exercicios", f"Unexpected delete message: {result.get('message')}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Lixeira (Soft Delete) Test Suite")
        print("=" * 60)
        
        # Test login first
        if not self.test_admin_login():
            print("\n❌ Cannot proceed without admin authentication")
            return False
        
        # Test conteudo soft delete flow
        print("\n" + "=" * 40)
        print("TESTING CONTEUDO SOFT DELETE FLOW")
        print("=" * 40)
        
        self.test_soft_delete_conteudo()
        self.test_conteudo_not_in_list()
        self.test_get_lixeira()
        self.test_restore_conteudo()
        self.test_conteudo_back_in_list()
        self.test_permanent_delete()
        self.test_conteudo_completely_gone()
        
        # Test exercicio soft delete
        print("\n" + "=" * 40)
        print("TESTING EXERCICIO SOFT DELETE")
        print("=" * 40)
        
        self.test_exercicio_soft_delete()
        
        # Test cleanup
        print("\n" + "=" * 40)
        print("TESTING CLEANUP FUNCTIONALITY")
        print("=" * 40)
        
        self.test_cleanup_expired()
        
        # Print final results
        self.print_final_results()
        
        return all(self.results.values())

    def print_final_results(self):
        """Print final test results summary"""
        print("\n" + "=" * 60)
        print("FINAL TEST RESULTS")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result)
        
        for test_name, result in self.results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<30} {status}")
        
        print("-" * 60)
        print(f"TOTAL: {passed_tests}/{total_tests} tests passed")
        
        if self.errors:
            print("\n🚨 ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"   {error}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! Lixeira functionality is working correctly.")
        else:
            print(f"\n⚠️  {total_tests - passed_tests} test(s) failed. Please check the errors above.")

def main():
    """Main test execution"""
    test_suite = LixeiraTestSuite()
    success = test_suite.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()