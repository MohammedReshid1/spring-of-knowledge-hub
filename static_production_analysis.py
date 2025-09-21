#!/usr/bin/env python3
"""
Spring of Knowledge Hub - Static Production Analysis
Comprehensive static analysis for production readiness without requiring running services.
"""

import os
import json
import sys
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from pathlib import Path
import ast

@dataclass
class AnalysisResult:
    category: str
    test_name: str
    status: str  # PASS, FAIL, WARN, INFO
    message: str
    details: Optional[Dict[str, Any]] = None

class StaticProductionAnalyzer:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.results: List[AnalysisResult] = []
        
    def add_result(self, category: str, test_name: str, status: str, message: str, details: Dict = None):
        """Add analysis result"""
        result = AnalysisResult(category, test_name, status, message, details)
        self.results.append(result)

    def analyze_project_structure(self):
        """Analyze overall project structure"""
        print("📁 Analyzing Project Structure...")
        
        # Check critical directories
        critical_dirs = {
            "backend/app": "Backend application code",
            "backend/app/models": "Data models",
            "backend/app/routers": "API routes",
            "backend/app/utils": "Utility functions",
            "src": "Frontend source code",
            "src/components": "React components",
            "src/pages": "Application pages",
            "src/hooks": "React hooks",
            "src/contexts": "React contexts",
        }
        
        for dir_path, description in critical_dirs.items():
            full_path = self.project_root / dir_path
            if full_path.exists() and full_path.is_dir():
                file_count = len(list(full_path.glob("**/*.py"))) + len(list(full_path.glob("**/*.tsx"))) + len(list(full_path.glob("**/*.ts")))
                self.add_result("Structure", f"{description}", "PASS", 
                              f"Directory exists with {file_count} files")
            else:
                self.add_result("Structure", f"{description}", "FAIL", 
                              f"Missing directory: {dir_path}")

    def analyze_backend_code(self):
        """Analyze backend code quality and structure"""
        print("🐍 Analyzing Backend Code...")
        
        backend_path = self.project_root / "backend/app"
        if not backend_path.exists():
            self.add_result("Backend", "Backend Code", "FAIL", "Backend directory not found")
            return
            
        # Check main application files
        main_files = {
            "main.py": "FastAPI application entry point",
            "db.py": "Database configuration",
            "utils/auth.py": "Authentication utilities",
            "utils/rbac.py": "Role-based access control",
        }
        
        for file_path, description in main_files.items():
            full_path = backend_path / file_path
            if full_path.exists():
                # Basic code analysis
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # Check for basic security patterns
                    security_checks = self._analyze_python_security(content, file_path)
                    
                    self.add_result("Backend", f"{description}", "PASS", 
                                  f"File exists ({len(content.splitlines())} lines)", 
                                  {"security_issues": security_checks})
                except Exception as e:
                    self.add_result("Backend", f"{description}", "WARN", 
                                  f"File exists but analysis failed: {str(e)}")
            else:
                self.add_result("Backend", f"{description}", "FAIL", 
                              f"Missing file: {file_path}")
        
        # Count models and routers
        models_count = len(list((backend_path / "models").glob("*.py"))) if (backend_path / "models").exists() else 0
        routers_count = len(list((backend_path / "routers").glob("*.py"))) if (backend_path / "routers").exists() else 0
        
        self.add_result("Backend", "API Coverage", "INFO", 
                      f"Found {models_count} models and {routers_count} routers")

    def _analyze_python_security(self, content: str, filename: str) -> List[str]:
        """Analyze Python code for security issues"""
        issues = []
        
        # Check for hardcoded secrets
        secret_patterns = [
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
        ]
        
        for pattern in secret_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                issues.append(f"Potential hardcoded secret in {filename}")
        
        # Check for SQL injection vulnerabilities
        if re.search(r'\.format\s*\(.*query', content, re.IGNORECASE):
            issues.append(f"Potential SQL injection risk in {filename}")
            
        # Check for proper error handling
        if 'except:' in content:
            issues.append(f"Bare except clause found in {filename}")
            
        return issues

    def analyze_frontend_code(self):
        """Analyze frontend code quality and structure"""
        print("⚛️ Analyzing Frontend Code...")
        
        src_path = self.project_root / "src"
        if not src_path.exists():
            self.add_result("Frontend", "Frontend Code", "FAIL", "Frontend src directory not found")
            return
            
        # Check critical frontend files
        critical_files = {
            "App.tsx": "Main application component",
            "main.tsx": "Application entry point",
            "contexts/AuthContext.tsx": "Authentication context",
            "hooks/useRoleAccess.tsx": "Role-based access hook",
            "lib/api.ts": "API client configuration",
        }
        
        for file_path, description in critical_files.items():
            full_path = src_path / file_path
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # Basic TypeScript/React analysis
                    tsx_checks = self._analyze_tsx_code(content, file_path)
                    
                    self.add_result("Frontend", f"{description}", "PASS", 
                                  f"File exists ({len(content.splitlines())} lines)",
                                  {"issues": tsx_checks})
                except Exception as e:
                    self.add_result("Frontend", f"{description}", "WARN", 
                                  f"File exists but analysis failed: {str(e)}")
            else:
                self.add_result("Frontend", f"{description}", "FAIL", 
                              f"Missing file: {file_path}")
        
        # Count components and pages
        components_count = len(list((src_path / "components").glob("**/*.tsx"))) if (src_path / "components").exists() else 0
        pages_count = len(list((src_path / "pages").glob("**/*.tsx"))) if (src_path / "pages").exists() else 0
        hooks_count = len(list((src_path / "hooks").glob("**/*.tsx"))) if (src_path / "hooks").exists() else 0
        
        self.add_result("Frontend", "Component Coverage", "INFO", 
                      f"Found {components_count} components, {pages_count} pages, {hooks_count} hooks")

    def _analyze_tsx_code(self, content: str, filename: str) -> List[str]:
        """Analyze TSX code for common issues"""
        issues = []
        
        # Check for console.log in production code
        if re.search(r'console\.log\s*\(', content):
            issues.append(f"Console.log statements found in {filename}")
            
        # Check for TODO/FIXME comments
        if re.search(r'(TODO|FIXME|HACK)', content, re.IGNORECASE):
            issues.append(f"TODO/FIXME comments found in {filename}")
            
        # Check for proper error handling in async functions
        if 'async' in content and 'try' not in content:
            issues.append(f"Async function without error handling in {filename}")
            
        return issues

    def analyze_dependencies(self):
        """Analyze project dependencies"""
        print("📦 Analyzing Dependencies...")
        
        # Analyze Python dependencies
        req_file = self.project_root / "backend/requirements.txt"
        if req_file.exists():
            with open(req_file, 'r') as f:
                requirements = f.read()
                
            # Check for critical dependencies
            critical_python_deps = [
                "fastapi", "uvicorn", "motor", "pydantic", 
                "passlib", "python-jose", "PyJWT"
            ]
            
            missing_python = []
            for dep in critical_python_deps:
                if dep not in requirements:
                    missing_python.append(dep)
            
            if not missing_python:
                dep_count = len([line for line in requirements.split('\n') if line.strip() and not line.startswith('#')])
                self.add_result("Dependencies", "Python Dependencies", "PASS", 
                              f"All critical dependencies present ({dep_count} total)")
            else:
                self.add_result("Dependencies", "Python Dependencies", "FAIL", 
                              f"Missing: {', '.join(missing_python)}")
                
            # Check for version pinning
            pinned_count = len(re.findall(r'>=|==|~=', requirements))
            total_deps = len([line for line in requirements.split('\n') if line.strip() and not line.startswith('#')])
            
            if pinned_count >= total_deps * 0.8:  # 80% of deps should be pinned
                self.add_result("Dependencies", "Version Pinning", "PASS", 
                              f"{pinned_count}/{total_deps} dependencies have version constraints")
            else:
                self.add_result("Dependencies", "Version Pinning", "WARN", 
                              f"Only {pinned_count}/{total_deps} dependencies have version constraints")
        else:
            self.add_result("Dependencies", "Python Dependencies", "FAIL", 
                          "requirements.txt not found")
        
        # Analyze Node.js dependencies
        package_file = self.project_root / "package.json"
        if package_file.exists():
            with open(package_file, 'r') as f:
                package_data = json.load(f)
                
            deps = package_data.get("dependencies", {})
            dev_deps = package_data.get("devDependencies", {})
            
            # Check for critical frontend dependencies
            critical_node_deps = [
                "react", "@tanstack/react-query", "react-router-dom",
                "typescript", "@types/react"
            ]
            
            all_deps = {**deps, **dev_deps}
            missing_node = []
            for dep in critical_node_deps:
                if dep not in all_deps:
                    missing_node.append(dep)
            
            if not missing_node:
                self.add_result("Dependencies", "Node.js Dependencies", "PASS", 
                              f"All critical dependencies present ({len(all_deps)} total)")
            else:
                self.add_result("Dependencies", "Node.js Dependencies", "FAIL", 
                              f"Missing: {', '.join(missing_node)}")
        else:
            self.add_result("Dependencies", "Node.js Dependencies", "FAIL", 
                          "package.json not found")

    def analyze_configuration(self):
        """Analyze configuration and setup"""
        print("⚙️ Analyzing Configuration...")
        
        # Check for environment configuration
        env_files = [".env.example", ".env.local", ".env"]
        env_found = []
        for env_file in env_files:
            if (self.project_root / env_file).exists():
                env_found.append(env_file)
        
        if env_found:
            self.add_result("Configuration", "Environment Files", "PASS", 
                          f"Environment configuration files: {', '.join(env_found)}")
        else:
            self.add_result("Configuration", "Environment Files", "WARN", 
                          "No environment configuration files found")
        
        # Check for TypeScript configuration
        ts_config = self.project_root / "tsconfig.json"
        if ts_config.exists():
            try:
                with open(ts_config, 'r') as f:
                    ts_data = json.load(f)
                    
                strict_mode = ts_data.get("compilerOptions", {}).get("strict", False)
                if strict_mode:
                    self.add_result("Configuration", "TypeScript Config", "PASS", 
                                  "TypeScript strict mode enabled")
                else:
                    self.add_result("Configuration", "TypeScript Config", "WARN", 
                                  "TypeScript strict mode not enabled")
            except Exception as e:
                self.add_result("Configuration", "TypeScript Config", "WARN", 
                              f"TypeScript config exists but analysis failed: {str(e)}")
        else:
            self.add_result("Configuration", "TypeScript Config", "WARN", 
                          "No TypeScript configuration found")
        
        # Check for build configuration
        vite_config = self.project_root / "vite.config.ts"
        if vite_config.exists():
            self.add_result("Configuration", "Build Configuration", "PASS", 
                          "Vite configuration found")
        else:
            self.add_result("Configuration", "Build Configuration", "WARN", 
                          "No build configuration found")

    def analyze_security_features(self):
        """Analyze security implementation"""
        print("🔒 Analyzing Security Features...")
        
        # Check RBAC implementation
        rbac_file = self.project_root / "backend/app/utils/rbac.py"
        if rbac_file.exists():
            with open(rbac_file, 'r') as f:
                rbac_content = f.read()
                
            # Check for comprehensive RBAC features
            rbac_features = [
                ("Role enum", "class Role" in rbac_content or "enum Role" in rbac_content),
                ("Permission enum", "class Permission" in rbac_content or "enum Permission" in rbac_content),
                ("Permission checking", "has_permission" in rbac_content),
                ("Role hierarchy", "ROLE_HIERARCHY" in rbac_content),
                ("Access control", "can_access_role" in rbac_content),
            ]
            
            implemented_features = [name for name, present in rbac_features if present]
            
            if len(implemented_features) >= 4:
                self.add_result("Security", "RBAC Implementation", "PASS", 
                              f"Comprehensive RBAC system: {', '.join(implemented_features)}")
            else:
                self.add_result("Security", "RBAC Implementation", "WARN", 
                              f"Basic RBAC system: {', '.join(implemented_features)}")
        else:
            self.add_result("Security", "RBAC Implementation", "FAIL", 
                          "No RBAC implementation found")
        
        # Check authentication implementation
        auth_file = self.project_root / "backend/app/utils/auth.py"
        if auth_file.exists():
            with open(auth_file, 'r') as f:
                auth_content = f.read()
                
            auth_features = [
                ("Password hashing", "bcrypt" in auth_content or "passlib" in auth_content),
                ("JWT tokens", "jwt" in auth_content or "JWT" in auth_content),
                ("Token validation", "decode" in auth_content and "token" in auth_content),
                ("Secure key generation", "secrets" in auth_content),
            ]
            
            implemented_auth = [name for name, present in auth_features if present]
            
            if len(implemented_auth) >= 3:
                self.add_result("Security", "Authentication System", "PASS", 
                              f"Secure authentication: {', '.join(implemented_auth)}")
            else:
                self.add_result("Security", "Authentication System", "WARN", 
                              f"Basic authentication: {', '.join(implemented_auth)}")
        else:
            self.add_result("Security", "Authentication System", "FAIL", 
                          "No authentication implementation found")

    def analyze_feature_completeness(self):
        """Analyze feature implementation completeness"""
        print("🎯 Analyzing Feature Completeness...")
        
        # Check backend API coverage
        routers_path = self.project_root / "backend/app/routers"
        if routers_path.exists():
            router_files = list(routers_path.glob("*.py"))
            router_names = [f.stem for f in router_files if f.stem != "__init__"]
            
            expected_routers = [
                "users", "students", "classes", "teachers", "payments", 
                "branches", "stats", "fees", "attendance", "backup_logs"
            ]
            
            implemented_routers = [name for name in expected_routers if name in router_names]
            
            coverage = len(implemented_routers) / len(expected_routers) * 100
            
            if coverage >= 90:
                self.add_result("Features", "API Coverage", "PASS", 
                              f"{coverage:.1f}% API coverage ({len(implemented_routers)}/{len(expected_routers)} modules)")
            elif coverage >= 70:
                self.add_result("Features", "API Coverage", "WARN", 
                              f"{coverage:.1f}% API coverage ({len(implemented_routers)}/{len(expected_routers)} modules)")
            else:
                self.add_result("Features", "API Coverage", "FAIL", 
                              f"{coverage:.1f}% API coverage ({len(implemented_routers)}/{len(expected_routers)} modules)")
        
        # Check frontend component coverage
        components_path = self.project_root / "src/components"
        if components_path.exists():
            component_dirs = [d for d in components_path.iterdir() if d.is_dir()]
            component_areas = [d.name for d in component_dirs]
            
            expected_areas = [
                "auth", "dashboard", "students", "classes", "teachers", 
                "payments", "settings", "branches", "ui"
            ]
            
            implemented_areas = [area for area in expected_areas if area in component_areas]
            
            ui_coverage = len(implemented_areas) / len(expected_areas) * 100
            
            if ui_coverage >= 80:
                self.add_result("Features", "UI Coverage", "PASS", 
                              f"{ui_coverage:.1f}% UI coverage ({len(implemented_areas)}/{len(expected_areas)} areas)")
            elif ui_coverage >= 60:
                self.add_result("Features", "UI Coverage", "WARN", 
                              f"{ui_coverage:.1f}% UI coverage ({len(implemented_areas)}/{len(expected_areas)} areas)")
            else:
                self.add_result("Features", "UI Coverage", "FAIL", 
                              f"{ui_coverage:.1f}% UI coverage ({len(implemented_areas)}/{len(expected_areas)} areas)")

    def analyze_production_readiness(self):
        """Analyze production deployment readiness"""
        print("🚀 Analyzing Production Readiness...")
        
        # Check for deployment files
        deployment_files = {
            "Dockerfile": "Docker containerization",
            "docker-compose.yml": "Docker orchestration", 
            ".dockerignore": "Docker ignore rules",
            ".gitignore": "Git ignore rules",
            "README.md": "Project documentation",
        }
        
        for file_name, description in deployment_files.items():
            if (self.project_root / file_name).exists():
                self.add_result("Deployment", description, "PASS", f"{file_name} exists")
            else:
                status = "WARN" if file_name in ["Dockerfile", "docker-compose.yml"] else "INFO"
                self.add_result("Deployment", description, status, f"{file_name} missing")
        
        # Check for CI/CD configuration
        ci_paths = [
            ".github/workflows",
            ".gitlab-ci.yml", 
            "Jenkinsfile",
            ".circleci"
        ]
        
        ci_found = any((self.project_root / path).exists() for path in ci_paths)
        if ci_found:
            self.add_result("Deployment", "CI/CD Configuration", "PASS", "CI/CD configuration found")
        else:
            self.add_result("Deployment", "CI/CD Configuration", "INFO", "No CI/CD configuration found")

    def generate_comprehensive_report(self):
        """Generate detailed production readiness report"""
        print("\n" + "="*100)
        print("📊 COMPREHENSIVE PRODUCTION READINESS ANALYSIS")
        print("="*100)
        
        # Categorize results
        categories = {}
        for result in self.results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)
        
        total_pass = total_fail = total_warn = total_info = 0
        category_scores = {}
        
        # Report by category
        for category_name, results in categories.items():
            if not results:
                continue
                
            print(f"\n🔸 {category_name.upper()} ANALYSIS")
            print("-" * 70)
            
            cat_pass = cat_fail = cat_warn = cat_info = 0
            
            for result in results:
                status_emoji = {
                    "PASS": "✅",
                    "FAIL": "❌", 
                    "WARN": "⚠️",
                    "INFO": "ℹ️"
                }.get(result.status, "❓")
                
                print(f"{status_emoji} {result.test_name}: {result.message}")
                
                # Show additional details for security issues
                if result.details and "security_issues" in result.details:
                    for issue in result.details["security_issues"]:
                        print(f"    🔐 Security: {issue}")
                        
                if result.details and "issues" in result.details:
                    for issue in result.details["issues"]:
                        print(f"    ⚠️  Issue: {issue}")
                
                if result.status == "PASS":
                    cat_pass += 1
                elif result.status == "FAIL":
                    cat_fail += 1
                elif result.status == "WARN":
                    cat_warn += 1
                elif result.status == "INFO":
                    cat_info += 1
            
            # Category summary
            total_tests = len(results)
            critical_tests = cat_pass + cat_fail + cat_warn  # Exclude INFO from scoring
            score = (cat_pass / critical_tests * 100) if critical_tests > 0 else 100
            category_scores[category_name] = score
            
            print(f"\n{category_name} Score: {score:.1f}% ({cat_pass}/{critical_tests} passed)")
            
            total_pass += cat_pass
            total_fail += cat_fail
            total_warn += cat_warn
            total_info += cat_info
        
        # Overall assessment
        total_critical = total_pass + total_fail + total_warn
        overall_score = (total_pass / total_critical * 100) if total_critical > 0 else 100
        
        print(f"\n" + "="*100)
        print("🎯 OVERALL ASSESSMENT")
        print("="*100)
        
        print(f"Total Tests: {len(self.results)}")
        print(f"✅ Passed: {total_pass} ({(total_pass/total_critical)*100:.1f}%)")
        print(f"❌ Failed: {total_fail} ({(total_fail/total_critical)*100:.1f}%)")
        print(f"⚠️  Warnings: {total_warn} ({(total_warn/total_critical)*100:.1f}%)")
        print(f"ℹ️  Info: {total_info}")
        
        print(f"\n🏆 PRODUCTION READINESS SCORE: {overall_score:.1f}%")
        
        # Category breakdown
        print(f"\n📊 CATEGORY SCORES:")
        for category, score in category_scores.items():
            status_emoji = "✅" if score >= 80 else "⚠️" if score >= 60 else "❌"
            print(f"{status_emoji} {category}: {score:.1f}%")
        
        # Production readiness verdict
        print(f"\n🚦 PRODUCTION READINESS VERDICT:")
        if overall_score >= 90 and total_fail == 0:
            print("🟢 READY FOR PRODUCTION")
            verdict = "READY"
        elif overall_score >= 80 and total_fail <= 2:
            print("🟡 MOSTLY READY - MINOR ISSUES")
            verdict = "MOSTLY_READY"
        elif overall_score >= 60:
            print("🟠 NEEDS WORK - MODERATE ISSUES")
            verdict = "NEEDS_WORK"
        else:
            print("🔴 NOT READY - CRITICAL ISSUES")
            verdict = "NOT_READY"
        
        # Recommendations
        print(f"\n📝 PRODUCTION RECOMMENDATIONS:")
        
        if total_fail > 0:
            print("🔴 CRITICAL (Must Fix):")
            fail_count = 0
            for result in self.results:
                if result.status == "FAIL" and fail_count < 5:
                    print(f"   • {result.test_name}: {result.message}")
                    fail_count += 1
        
        if total_warn > 0:
            print("🟡 IMPORTANT (Should Fix):")
            warn_count = 0
            for result in self.results:
                if result.status == "WARN" and warn_count < 5:
                    print(f"   • {result.test_name}: {result.message}")
                    warn_count += 1
        
        print(f"\n🎯 NEXT STEPS FOR PRODUCTION:")
        if verdict == "READY":
            steps = [
                "Set up production environment variables",
                "Configure HTTPS and SSL certificates", 
                "Set up monitoring and logging",
                "Implement backup strategies",
                "Perform load testing",
                "Security audit and penetration testing"
            ]
        elif verdict == "MOSTLY_READY":
            steps = [
                "Address remaining warnings",
                "Complete missing documentation",
                "Set up deployment pipeline",
                "Configure monitoring",
                "Test in staging environment"
            ]
        else:
            steps = [
                "Fix all critical failures",
                "Address security concerns",
                "Complete missing features",
                "Improve code quality",
                "Add comprehensive testing"
            ]
        
        for i, step in enumerate(steps, 1):
            print(f"   {i}. {step}")
        
        return overall_score, verdict

    def run_analysis(self):
        """Run complete static analysis"""
        print("🔍 Spring of Knowledge Hub - Static Production Analysis")
        print("="*100)
        print("Analyzing codebase for production readiness...\n")
        
        try:
            self.analyze_project_structure()
            self.analyze_backend_code()
            self.analyze_frontend_code()
            self.analyze_dependencies()
            self.analyze_configuration()
            self.analyze_security_features()
            self.analyze_feature_completeness()
            self.analyze_production_readiness()
            
            score, verdict = self.generate_comprehensive_report()
            
            print(f"\n🏁 Analysis completed!")
            print(f"📊 Final Score: {score:.1f}%")
            print(f"🎯 Verdict: {verdict}")
            
            return score, verdict
            
        except Exception as e:
            print(f"❌ Analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return 0, "ERROR"

def main():
    """Main function"""
    analyzer = StaticProductionAnalyzer()
    score, verdict = analyzer.run_analysis()
    
    # Exit with appropriate code
    if verdict in ["READY", "MOSTLY_READY"]:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()