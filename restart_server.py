import subprocess
import os
import time
import signal
import sys

def find_node_server_process():
    """Find the node server process"""
    try:
        # Look for processes running server.js
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if 'node' in line and 'server.js' in line and not 'grep' in line:
                # Extract PID from line
                parts = line.split()
                if len(parts) >= 2:
                    pid = parts[1]
                    return int(pid)
    except:
        pass
    return None

def main():
    # Find and kill existing server process
    pid = find_node_server_process()
    if pid:
        print(f"Found server process with PID: {pid}, killing it...")
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(2)
        except ProcessLookupError:
            print(f"Process {pid} not found")
        except Exception as e:
            print(f"Error killing process {pid}: {e}")
    
    # Wait a bit
    time.sleep(1)
    
    # Start the server
    print("Starting server...")
    try:
        # Start in background
        process = subprocess.Popen(['npm', 'run', 'start'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE,
                                  text=True)
        print(f"Server started with PID: {process.pid}")
        print("Server is running on http://localhost:5500")
        
        # Keep the script running
        process.wait()
        
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()