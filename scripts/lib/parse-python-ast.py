"""Batch Python AST extractor used by build-source-reference.mjs.

Input and output are newline-delimited JSON so historical blobs can be parsed
without checking a commit out or creating one temporary file per blob.
"""

from __future__ import annotations

import ast
import json
import sys


def signature(node: ast.AST) -> str:
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return ""
    arguments = []
    positional = [*node.args.posonlyargs, *node.args.args]
    defaults = [None] * (len(positional) - len(node.args.defaults)) + list(node.args.defaults)
    for argument, default in zip(positional, defaults):
        value = argument.arg
        if argument.annotation:
            value += f": {ast.unparse(argument.annotation)}"
        if default:
            value += f" = {ast.unparse(default)}"
        arguments.append(value)
    if node.args.vararg:
        arguments.append(f"*{node.args.vararg.arg}")
    arguments.extend(argument.arg for argument in node.args.kwonlyargs)
    if node.args.kwarg:
        arguments.append(f"**{node.args.kwarg.arg}")
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    result = f"{prefix} {node.name}({', '.join(arguments)})"
    if node.returns:
        result += f" -> {ast.unparse(node.returns)}"
    return result


def parse(record: dict[str, str]) -> dict[str, object]:
    # Git history can contain source with lone Unicode surrogates. Python's AST
    # parser rejects those before it can report a useful syntax error, so replace
    # only the invalid code points while preserving every well-formed character.
    source = record["text"].encode("utf-8", errors="replace").decode("utf-8")
    try:
        tree = ast.parse(source, filename=record["path"], type_comments=True)
    except (SyntaxError, ValueError) as error:
        return {
            "sha": record["sha"],
            "path": record["path"],
            "symbols": [],
            "calls": [],
            "errors": [{
                "message": str(error),
                "line": getattr(error, "lineno", None),
                "column": getattr(error, "offset", None),
            }],
        }

    symbols: list[dict[str, object]] = []
    calls: list[dict[str, object]] = []
    containers: list[str] = []
    exported_names: set[str] | None = None

    for item in tree.body:
        if isinstance(item, ast.Assign):
            for target in item.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    try:
                        exported_names = set(ast.literal_eval(item.value))
                    except (ValueError, TypeError):
                        pass

    class Visitor(ast.NodeVisitor):
        current_symbol: str | None = None

        def add_symbol(self, node: ast.AST, name: str, kind: str, value: str = "") -> None:
            qualified = ".".join([*containers, name])
            doc = ast.get_docstring(node, clean=True) if isinstance(
                node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
            ) else None
            symbols.append({
                "name": name,
                "qualifiedName": qualified,
                "kind": kind,
                "signature": value,
                "visibility": "internal" if name.startswith("_") else "public",
                "exported": name in exported_names if exported_names is not None else not name.startswith("_"),
                "documentation": doc or "",
                "lineStart": getattr(node, "lineno", 1),
                "lineEnd": getattr(node, "end_lineno", getattr(node, "lineno", 1)),
            })

        def visit_ClassDef(self, node: ast.ClassDef) -> None:
            bases = ", ".join(ast.unparse(base) for base in node.bases)
            self.add_symbol(node, node.name, "class", f"class {node.name}({bases})" if bases else f"class {node.name}")
            previous = self.current_symbol
            self.current_symbol = ".".join([*containers, node.name])
            containers.append(node.name)
            self.generic_visit(node)
            containers.pop()
            self.current_symbol = previous

        def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
            self._visit_function(node)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
            self._visit_function(node)

        def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
            kind = "method" if containers else "function"
            self.add_symbol(node, node.name, kind, signature(node))
            previous = self.current_symbol
            self.current_symbol = ".".join([*containers, node.name])
            containers.append(node.name)
            self.generic_visit(node)
            containers.pop()
            self.current_symbol = previous

        def visit_Call(self, node: ast.Call) -> None:
            if self.current_symbol:
                try:
                    target = ast.unparse(node.func)
                except ValueError:
                    target = ""
                if target:
                    calls.append({
                        "from": self.current_symbol,
                        "to": target,
                        "line": getattr(node, "lineno", 1),
                    })
            self.generic_visit(node)

    Visitor().visit(tree)
    return {
        "sha": record["sha"],
        "path": record["path"],
        "symbols": symbols,
        "calls": calls,
        "errors": [],
    }


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        print(json.dumps(parse(json.loads(line)), ensure_ascii=True))
    except Exception as error:  # Preserve a record rather than silently dropping a blob.
        print(json.dumps({"errors": [{"message": repr(error)}], "symbols": [], "calls": []}, ensure_ascii=True))
