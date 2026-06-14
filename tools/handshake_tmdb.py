#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error

def load_env():
    """Carrega as variáveis de ambiente manualmente do arquivo .env na raiz do projeto"""
    env_data = {}
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    
    if not os.path.exists(env_path):
        print(f"[-] Erro: Arquivo .env não encontrado em: {env_path}")
        return env_data
        
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env_data[key.strip()] = val.strip()
    return env_data

def test_tmdb_connection():
    print("[*] Iniciando teste de conexão (Handshake) com o TMDB...")
    env = load_env()
    
    bearer_token = env.get("TMDB_BEARER_TOKEN", "")
    api_key = env.get("TMDB_API_KEY", "")
    
    headers = {
        "accept": "application/json"
    }
    
    url = "https://api.themoviedb.org/3/authentication"
    
    if bearer_token and bearer_token != "seu_bearer_token_aqui" and bearer_token != "":
        print("[*] Autenticando com TMDB_BEARER_TOKEN (Bearer Token v4)...")
        headers["Authorization"] = f"Bearer {bearer_token}"
    elif api_key and api_key != "sua_api_key_aqui" and api_key != "":
        print("[*] Autenticando com TMDB_API_KEY (API Key v3)...")
        url = f"{url}?api_key={api_key}"
    else:
        print("[-] Erro: Nenhuma credencial válida encontrada no arquivo .env.")
        print("    Por favor, configure TMDB_BEARER_TOKEN ou TMDB_API_KEY no arquivo .env.")
        sys.exit(1)
        
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            response_body = response.read().decode('utf-8')
            data = json.loads(response_body)
            
            if status_code == 200 and data.get("success") is True:
                print("[+] Sucesso! Conexão estabelecida e credenciais validadas com o TMDB.")
                print(f"    Resposta da API: {data.get('status_message', 'Success.')}")
                sys.exit(0)
            else:
                print(f"[-] Falha na validação das credenciais. Status HTTP: {status_code}")
                print(f"    Resposta: {response_body}")
                sys.exit(1)
                
    except urllib.error.HTTPError as e:
        print(f"[-] Erro de requisição HTTP: Código {e.code}")
        try:
            err_body = e.read().decode('utf-8')
            err_data = json.loads(err_body)
            print(f"    Mensagem do TMDB: {err_data.get('status_message', 'Erro desconhecido.')}")
        except Exception:
            print(f"    Detalhes do Erro: {e.reason}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[-] Erro de Conexão: Não foi possível alcançar os servidores do TMDB.")
        print(f"    Motivo: {e.reason}")
        sys.exit(1)
    except Exception as e:
        print(f"[-] Ocorreu um erro inesperado: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_tmdb_connection()
