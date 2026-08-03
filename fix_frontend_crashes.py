import os
import re

def fix_frontend(src_dir):
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original_content = content
                
                # Fix .toFixed() by wrapping with Number( ... ?? 0 )
                # We look for patterns like:   something.toFixed(
                # This regex is simplistic but works for most cases like (variable).toFixed or variable.toFixed
                # To be completely safe, we replace `.toFixed(` with something that checks if it exists, or cast it.
                # Actually, the user asked to replace `value.toFixed()` with `Number(value ?? 0).toFixed()`
                # Let's do a targeted replace for common patterns instead of a blind regex that might break JSX syntax.

                # Let's use a regex that matches identifiers and property accesses before .toFixed
                # e.g.  data.latency.toFixed(1) -> Number(data.latency ?? 0).toFixed(1)
                # match variable names, brackets, dots, but not spaces.
                pattern = r'([a-zA-Z0-9_?.\[\]\(\)]+)\.toFixed\('
                
                def repl_to_fixed(m):
                    expr = m.group(1)
                    if expr.startswith('Number(') or expr.startswith('(Number('):
                        return m.group(0) # already wrapped
                    if expr.isdigit() or re.match(r'^\d+\.\d+$', expr):
                        return m.group(0) # literal number
                    
                    # Remove surrounding parens if they exist just for cleanup, but not strictly necessary
                    if expr.startswith('(') and expr.endswith(')'):
                        inner = expr[1:-1]
                        return f'(Number({inner} ?? 0)).toFixed('
                    return f'(Number({expr} ?? 0)).toFixed('

                content = re.sub(pattern, repl_to_fixed, content)

                # Fix stoppingSim which is undefined in prediction page
                if "page.tsx" in filepath and "predictions" in filepath:
                    content = content.replace("disabled={stoppingSim}", "disabled={false}")
                    content = content.replace("{stoppingSim ? \"Restoring...\" : \"Stop Simulation\"}", "\"Stop Simulation\"")

                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Fixed crashes in {filepath}")

if __name__ == '__main__':
    fix_frontend(r'c:\Users\Sekar Harshitha\Downloads\flood prediction\frontend\src')
