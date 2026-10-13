#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
任务看板 —— 接口冒烟测试。

用途：部署或改完代码后，一条命令确认核心链路没被打断。
    python scripts/api-smoke.py
    python scripts/api-smoke.py --base http://192.0.2.10:8080/api

只依赖标准库。脚本会自己建一个临时项目和临时成员，结束时清理干净，
不会污染现有数据（--keep 可保留，便于在界面上翻看）。
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

ADMIN_USER = "admin"
ADMIN_PASSWORD = "Admin@123456"
MEMBER_USER = "smoke_member"
MEMBER_PASSWORD = "Smoke@123456"
PROJECT_NAME = "SMOKE-自动测试"

PASSED = []
FAILED = []


def call(base, method, path, token=None, body=None, raw=False, expect=None):
    """发一个请求；expect 传入时状态码不符直接判定用例失败。"""
    url = f"{base}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            payload = response.read()
    except urllib.error.HTTPError as error:
        status = error.code
        payload = error.read()

    if expect is not None and status != expect:
        raise AssertionError(f"{method} {path} 期望 {expect}，实际 {status}：{payload[:200]!r}")

    if raw:
        return status, payload
    if not payload:
        return status, None
    try:
        return status, json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        return status, payload.decode("utf-8", "replace")


def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  [通过] {name}")
    else:
        FAILED.append(f"{name} {detail}".strip())
        print(f"  [失败] {name} {detail}")


def find_version(base, token, name):
    _, projects = call(base, "GET", "/projects", token=token)
    for project in projects or []:
        if project["name"] == name:
            return project["id"]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:3000/api")
    parser.add_argument("--keep", action="store_true", help="保留测试数据，便于在界面上翻看")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    print(f"接口冒烟测试 -> {base}\n")

    # ---------- 1. 认证 ----------
    print("1) 认证")
    _, login = call(base, "POST", "/auth/login", body={"username": ADMIN_USER, "password": ADMIN_PASSWORD})
    token = (login or {}).get("accessToken")
    check("管理员登录拿到 token", bool(token))
    if not token:
        print("\n登录失败，后续用例无法继续。请确认账号密码与是否已执行 seed。")
        return 1

    status, _ = call(base, "GET", "/projects")
    check("未带 token 被拒 (401)", status == 401, f"实际 {status}")

    _, me = call(base, "GET", "/auth/me", token=token)
    check("GET /auth/me 返回本人", (me or {}).get("username") == ADMIN_USER)

    # ---------- 2. 项目 ----------
    print("\n2) 项目")
    stale = find_version(base, token, PROJECT_NAME)
    if stale:
        call(base, "DELETE", f"/projects/{stale}?force=true", token=token)

    _, project = call(
        base,
        "POST",
        "/projects",
        token=token,
        body={
            "name": PROJECT_NAME,
            "description": "冒烟测试专用，可随时删除",
            "startDate": "2026-10-01",
            "endDate": "2026-10-30",
        },
        expect=201,
    )
    vid = project["id"]
    check("新项目默认 ACTIVE", project.get("status") == "ACTIVE")
    check("日期字段按 YYYY-MM-DD 返回", project.get("startDate") == "2026-10-01", f"实际 {project.get('startDate')}")
    check("新项目汇总为空", project.get("summary", {}).get("total") == 0)

    status, _ = call(base, "POST", "/projects", token=token, body={"name": PROJECT_NAME})
    check("重复项目名称被拒 (409)", status == 409, f"实际 {status}")

    # ---------- 3. 成员 ----------
    print("\n3) 成员")
    _, users = call(base, "GET", "/users?includeInactive=true", token=token)
    member = next((u for u in (users or []) if u["username"] == MEMBER_USER), None)
    if not member:
        _, member = call(
            base,
            "POST",
            "/users",
            token=token,
            body={
                "username": MEMBER_USER,
                "displayName": "冒烟测试员",
                "role": "MEMBER",
                "password": MEMBER_PASSWORD,
            },
            expect=201,
        )
    check("成员账号可用", bool(member))

    # ---------- 4. 任务字段与中文编码 ----------
    print("\n4) 任务字段与中文编码")
    specs = [
        {
            "title": "登录模块功能测试",
            "priority": "P1",
            "progress": 60,
            "plannedStartDate": "2026-10-01",
            "plannedEndDate": "2026-10-20",
            "actualStartDate": "2026-10-02",
            "participantIds": [member["id"]],
        },
        {"title": "权限越权测试", "priority": "P0", "progress": 30, "plannedEndDate": "2026-10-05"},
        {"title": "兼容性回归", "priority": "P3", "progress": 100, "plannedEndDate": "2026-10-30"},
    ]
    created = [
        call(base, "POST", "/tasks", token=token, body={**spec, "projectId": vid}, expect=201)[1]
        for spec in specs
    ]
    check("中文标题原样落库", created[0]["title"] == "登录模块功能测试", f"实际 {created[0]['title']!r}")
    check(
        "参与人多选已保存",
        [p["displayName"] for p in created[0]["participants"]] == ["冒烟测试员"],
        f"实际 {created[0]['participants']}",
    )
    check(
        "四个日期按 YYYY-MM-DD 存取",
        created[0]["plannedStartDate"] == "2026-10-01"
        and created[0]["plannedEndDate"] == "2026-10-20"
        and created[0]["actualStartDate"] == "2026-10-02"
        and created[0]["actualEndDate"] is None,
        f"实际 {created[0]['plannedStartDate']} / {created[0]['plannedEndDate']} / {created[0]['actualStartDate']}",
    )
    check("同列内 sortIndex 递增", [t["sortIndex"] for t in created] == [0, 1, 2], f"实际 {[t['sortIndex'] for t in created]}")
    check(
        "计划结束日期已过且未完成 -> 逾期",
        created[1]["overdue"] is True and created[2]["overdue"] is False,
        f"实际 {created[1]['overdue']} / {created[2]['overdue']}",
    )

    status, err = call(
        base, "POST", "/tasks", token=token,
        body={"projectId": vid, "title": "进度非整数", "progress": 60.5},
    )
    check("进度拒绝非整数 (400)", status == 400, f"实际 {status} {err}")

    status, err = call(
        base, "POST", "/tasks", token=token,
        body={"projectId": vid, "title": "进度越界", "progress": 101},
    )
    check("进度拒绝越界值 (400)", status == 400, f"实际 {status} {err}")

    _, filtered = call(base, "GET", f"/projects/{vid}/tasks?participantId={member['id']}", token=token)
    check("可按参与人筛选", filtered["total"] == 1, f"实际 {filtered['total']}")

    _, summary = call(base, "GET", f"/projects/{vid}/summary", token=token)
    check("平均进度 = (60+30+100)/3 ≈ 63", summary["avgProgress"] == 63, f"实际 {summary['avgProgress']}")
    check("完成率初始为 0", summary["completionRate"] == 0)
    check("按状态计数正确", summary["byStatus"] == {"TODO": 3, "IN_PROGRESS": 0, "BLOCKED": 0, "DONE": 0}, f"实际 {summary['byStatus']}")

    # ---------- 5. 拖拽 ----------
    print("\n5) 拖拽改状态与进度联动")
    _, moved = call(
        base, "PATCH", f"/tasks/{created[0]['id']}/status", token=token,
        body={"status": "DONE", "targetIndex": 0}, expect=200,
    )
    check("拖到已完成自动置进度 100", moved["progress"] == 100, f"实际 {moved['progress']}")
    check("拖到已完成记录完成时间", bool(moved["completedAt"]))

    _, summary2 = call(base, "GET", f"/projects/{vid}/summary", token=token)
    check("平均进度重算为 77", summary2["avgProgress"] == 77, f"实际 {summary2['avgProgress']}")
    check("完成率为 33.3%", summary2["completionRate"] == 33.3, f"实际 {summary2['completionRate']}")

    _, back = call(
        base, "PATCH", f"/tasks/{created[0]['id']}/status", token=token,
        body={"status": "IN_PROGRESS"}, expect=200,
    )
    check("拖出已完成时进度不清零", back["progress"] == 100, f"实际 {back['progress']}")

    # ---------- 6. 权限边界 ----------
    print("\n6) 成员权限边界")
    _, mlogin = call(base, "POST", "/auth/login", body={"username": MEMBER_USER, "password": MEMBER_PASSWORD})
    mtoken = (mlogin or {}).get("accessToken")
    check("成员可登录", bool(mtoken))

    status, _ = call(base, "PATCH", f"/tasks/{created[0]['id']}", token=mtoken, body={"progress": 10})
    check("参与人可以改自己参与的任务 (200)", status == 200, f"实际 {status}")

    status, _ = call(base, "PATCH", f"/tasks/{created[1]['id']}", token=mtoken, body={"progress": 10})
    check("与自己无关的任务不能改 (403)", status == 403, f"实际 {status}")

    status, _ = call(base, "DELETE", f"/tasks/{created[0]['id']}", token=mtoken)
    check("参与人不能删他人创建的任务 (403)", status == 403, f"实际 {status}")

    status, _ = call(base, "DELETE", f"/tasks/{created[1]['id']}", token=mtoken)
    check("无关任务也不能删 (403)", status == 403, f"实际 {status}")

    status, _ = call(
        base, "POST", "/users", token=mtoken,
        body={"username": "smoke_x", "displayName": "x", "role": "MEMBER", "password": "123456"},
    )
    check("成员不能建用户 (403)", status == 403, f"实际 {status}")

    status, _ = call(base, "GET", f"/projects/{vid}/board", token=mtoken)
    check("成员可以看看板 (200)", status == 200, f"实际 {status}")

    # ---------- 7. 评论与日志 ----------
    print("\n7) 评论与操作日志")
    _, comment = call(
        base, "POST", f"/tasks/{created[1]['id']}/comments", token=mtoken,
        body={"body": "接口已联调通过，明天开始回归"}, expect=201,
    )
    check("评论内容原样保存", comment["body"] == "接口已联调通过，明天开始回归", f"实际 {comment['body']!r}")

    _, activities = call(base, "GET", f"/tasks/{created[0]['id']}/activities", token=token)
    actions = [a["action"] for a in activities]
    check("日志含创建", "TASK_CREATED" in actions, f"实际 {actions}")
    check("日志含状态变更", "STATUS_CHANGED" in actions, f"实际 {actions}")
    _, activities2 = call(base, "GET", f"/tasks/{created[1]['id']}/activities", token=token)
    check("日志含评论", "COMMENT_ADDED" in [a["action"] for a in activities2])

    # ---------- 8. 统计 ----------
    print("\n8) 统计")
    _, stats = call(base, "GET", f"/stats/projects/{vid}", token=token)
    check("按状态聚合总数正确", sum(x["count"] for x in stats["byStatus"]) == 3)
    check("按优先级聚合总数正确", sum(x["count"] for x in stats["byPriority"]) == 3)
    check("含未分配分组", any(a["label"] == "未分配" for a in stats["byAssignee"]))
    check("统计已不含模块维度", "byModule" not in stats, f"实际字段 {list(stats)}")

    # ---------- 9. 清理 ----------
    print("\n9) 清理")
    if args.keep:
        print(f"  [跳过] 保留测试数据：项目 id = {vid}")
    else:
        call(base, "DELETE", f"/projects/{vid}?force=true", token=token)
        status, _ = call(base, "GET", f"/projects/{vid}", token=token)
        check("项目已连同任务删除 (404)", status == 404, f"实际 {status}")
        call(base, "DELETE", f"/users/{member['id']}", token=token)

    print(f"\n结果：通过 {len(PASSED)} 项，失败 {len(FAILED)} 项")
    for item in FAILED:
        print(f"  - {item}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
