import os
import sys
import subprocess

def run_migrations():
    print("Running Alembic Migrations to Supabase...")
    backend_dir = os.path.dirname(__file__)
    
    print("\n--- Generating Migration Script ---")
    gen_result = subprocess.run(
        [sys.executable, "-m", "alembic", "revision", "--autogenerate", "-m", "Initial Supabase Migration"],
        cwd=backend_dir,
        capture_output=True,
        text=True
    )
    print(gen_result.stdout)
    if gen_result.stderr:
        print(gen_result.stderr)
        
    if gen_result.returncode != 0:
        print("❌ Migration generation failed. Please check the errors above.")
        return
        
    print("\n--- Applying Migrations ---")
    upg_result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        capture_output=True,
        text=True
    )
    print(upg_result.stdout)
    if upg_result.stderr:
        print(upg_result.stderr)
        
    if upg_result.returncode == 0:
        print("[SUCCESS] Database successfully migrated!")
    else:
        print("[ERROR] Migration application failed.")

if __name__ == "__main__":
    run_migrations()
