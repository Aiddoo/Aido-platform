"""README의 아키텍처 그림 원본. 구성이 바뀔 때만 고쳐서 다시 만든다(그림은 바이너리라 만들 때마다 저장소가 커진다).

    uvx --with diagrams python docs/architecture/render.py   # 필요: brew install graphviz librsvg webp

화살표는 부르는 쪽에서 불리는 쪽으로 긋는다. 계정 번호·IP·자원 ID·서비스 규모 숫자는 넣지 않는다.
로고 원본은 icons/의 SVG다(Simple Icons CC0, Google은 devicon, OpenAI·Gemini는 svgl).
"""

import base64
import re
import subprocess
import tempfile
from contextlib import contextmanager
from html import escape
from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS, ElastiCache
from diagrams.aws.general import Users
from diagrams.aws.network import ALB, InternetGateway
from diagrams.aws.security import IAMRole
from diagrams.aws.storage import S3
from diagrams.custom import Custom
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.container import Docker
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.network import Nginx
from diagrams.onprem.vcs import Github
from diagrams.programming.language import NodeJS

OUT = Path(__file__).parent
ICONS = OUT / "icons"
APP_ICON = OUT.parents[1] / "apps/mobile/assets/images/icon.png"
BUILD = Path(tempfile.mkdtemp(prefix="aido-diagrams-"))
# macOS 기본 한글 글꼴. 다른 OS에서 만들면 한글이 깨질 수 있다
FONT = "Apple SD Gothic Neo"
INK = "#1f2328"
MUTED = "#57606a"
LINE = "#6e7781"
GRAPH = {
    "fontname": FONT,
    "fontsize": "24",
    "fontcolor": INK,
    "pad": "0.3",
    "nodesep": "0.6",
    "ranksep": "0.9",
    "bgcolor": "white",
    # 꺾은선(ortho)은 선 이름이 선에서 떨어져 놓인다
    "splines": "spline",
}
# README 폭(약 840px)으로 줄어도 읽히는 크기다
NODE = {"fontname": FONT, "fontsize": "19", "fontcolor": INK}
EDGE = {"fontname": FONT, "fontsize": "16", "fontcolor": INK, "color": LINE, "penwidth": "1.6"}
BAND = {
    "fontname": FONT,
    "fontsize": "19",
    "fontcolor": INK,
    "bgcolor": "#f6f8fa",
    "pencolor": "#d0d7de",
    "margin": "26",
}


@contextmanager
def diagram(name, title, direction="LR", **graph):
    with Diagram(
        title,
        filename=str(OUT / name),
        outformat="png",
        show=False,
        direction=direction,
        graph_attr={**GRAPH, **graph},
        node_attr=NODE,
        edge_attr=EDGE,
    ):
        yield
    png = OUT / f"{name}.png"
    subprocess.run(["cwebp", "-quiet", "-lossless", "-z", "9", str(png), "-o", str(OUT / f"{name}.webp")], check=True)
    png.unlink()


def band(title, **attrs):
    return Cluster(f"<<B>{escape(title)}</B>>", graph_attr={**BAND, **attrs})


def text(label):
    """첫 줄은 이름(굵게), 나머지는 설명(작고 옅게)이다."""
    name, *rest = label.split("\n")
    html = f"<B>{escape(name)}</B>"
    if rest:
        lines = "<BR/>".join(escape(line) for line in rest)
        html += f'<BR/><FONT POINT-SIZE="15" COLOR="{MUTED}">{lines}</FONT>'
    return f"<{html}>"


def node(kind, label):
    """kind는 diagrams 노드 클래스이거나 logo()·tile()이 만든 그림 경로다."""
    attrs = {"height": str(2.0 + 0.4 * label.count("\n"))}
    if isinstance(kind, str):
        return Custom(text(label), kind, **attrs)
    return kind(text(label), **attrs)


def placed(name, x, y, size):
    """icons/<name>.svg를 100×100 판의 (x, y)에 size 크기로 놓는다."""
    svg = (ICONS / f"{name}.svg").read_text()
    svg = svg[svg.index("<svg") :]
    root = re.match(r"<svg\b[^>]*>", svg).group(0)
    moved = re.sub(r'\s(?:width|height|x|y)="[^"]*"', "", root)
    moved = moved.replace("<svg", f'<svg x="{x}" y="{y}" width="{size}" height="{size}"', 1)
    return moved + svg[len(root) :]


def rasterize(name, body):
    svg = BUILD / f"{name}.svg"
    svg.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'viewBox="0 0 100 100">{body}</svg>'
    )
    png = BUILD / f"{name}.png"
    subprocess.run(["rsvg-convert", "-w", "320", "-h", "320", str(svg), "-o", str(png)], check=True)
    return str(png)


def logo(name):
    return rasterize(name, placed(name, 16, 16, 68))


def tile(name, *names):
    """로고 서너 개를 한 칸에 모은다."""
    spots = {3: ((28, 4), (4, 52), (52, 52)), 4: ((5, 5), (52, 5), (5, 52), (52, 52))}[len(names)]
    return rasterize(name, "".join(placed(part, x, y, 43) for part, (x, y) in zip(names, spots)))


def app_icon():
    data = base64.b64encode(APP_ICON.read_bytes()).decode()
    return rasterize(
        "aido",
        '<defs><clipPath id="round"><rect x="14" y="14" width="72" height="72" rx="17"/></clipPath></defs>'
        f'<image x="14" y="14" width="72" height="72" clip-path="url(#round)" xlink:href="data:image/png;base64,{data}"/>',
    )


def system():
    # 세 줄로 읽는다: 위는 앱에서 바로 쓰는 서비스, 가운데는 요청이 지나는 길, 아래는 서버만 부르는 서비스
    with diagram("system", "Aido 서비스 구성", direction="TB", nodesep="0.75", ranksep="1.0"):
        with band("앱에서 바로 쓰는 서비스 · 결과는 서버가 다시 확인한다"):
            ota = node(logo("expo"), "EAS Update\nJS 무선 업데이트")
            kakao = node(logo("kakaotalk"), "카카오톡 공유\n친구 초대 링크")
            billing = node(logo("revenuecat"), "RevenueCat\n스토어 구독 결제")
            login = node(tile("login", "kakaotalk", "naver", "google", "apple"), "소셜 로그인\n카카오·네이버·구글·Apple")

        app = node(app_icon(), "Aido 앱 · 홈 화면 위젯\nExpo · React Native")
        with band("AWS · 서버 한 대 + DB 하나") as aws:
            proxy = node(Nginx, "Nginx\nTLS · 무중단 전환")
            api = node(logo("nestjs"), "NestJS API\n모듈러 모놀리스")
            db = node(PostgreSQL, "PostgreSQL\n업무 데이터 + pg-boss 큐")
            worker = node(logo("nestjs"), "pg-boss worker\n큐 · cron · 재시도\n(API와 한 프로세스)")
            # 요청이 지나는 순서대로 한 줄에 세운다
            aws.dot.body.append("{rank=same; %s}" % "; ".join(f'"{n.nodeid}"' for n in (proxy, api, db, worker)))

        # 내려오는 선이 제목을 가리지 않게 제목을 아래에 둔다
        with band("서버만 부르는 서비스", labelloc="b"):
            weather = node(logo("apple"), "WeatherKit\n날씨\n에어코리아 대기질")
            ai = node(tile("ai", "claude", "gemini", "openai"), "AI\nAnthropic\nGoogle · OpenAI")
            push = node(logo("expo"), "Expo Push\n묶음 발송\n영수증 확인")
            mail = node(logo("resend"), "Resend\n인증 코드\n재설정 메일")
            sentry = node(logo("sentry"), "Sentry\n오류 · 경보\nworker 생존 신호")
            discord = node(logo("discord"), "Discord\n가입 · 구독\n운영 알림")

        # 위 줄과 이은 선이 가운데 줄의 높이를 잡는다
        hold = Edge(style="invis")
        kakao >> hold >> proxy
        login >> hold >> db
        app >> Edge(label="HTTPS /v1", constraint="false") >> proxy
        proxy >> api
        api >> Edge(label="한 트랜잭션에\n업무 변경 + 작업 등록") >> db
        # `왼쪽 << 오른쪽`은 오른쪽에서 왼쪽으로 가는 화살표다
        db << Edge(label="작업을 꺼낸다") << worker

        # 위 줄: `위 << 아래`는 아래에서 위로 가는 화살표다
        ota << app
        kakao << app
        billing << app
        login << app
        login << Edge(label="code 교환 · 서명 검증") << api
        billing >> Edge(label="구독 웹훅") >> api

        # 아래 줄
        api >> weather
        api >> ai
        worker >> ai
        worker >> push
        worker >> mail
        worker >> sentry
        worker >> discord
        push >> Edge(label="APNs · FCM 푸시", constraint="false", style="dashed") >> app


def infra():
    with diagram("infra", "운영 인프라와 보안 경계"):
        users = node(Users, "앱 사용자")
        igw = node(InternetGateway, "인터넷")
        actions = node(GithubActions, "GitHub Actions\n빌드 · 배포")
        ghcr = node(Github, "GHCR\n이미지 저장소")
        with band("VPC"):
            with band("보안 그룹: 80·443 공개, 22는 키 전용 SSH", bgcolor="#eef6ff"):
                with band("EC2 한 대", bgcolor="white"):
                    host = node(EC2, "호스트\n배포 · 백업")
                    proxy = node(Nginx, "Nginx\n:443 TLS")
                    with band("Docker · 서버 안에서만 열림 (127.0.0.1)", bgcolor="#f6f8fa"):
                        blue = node(Docker, "API blue\n:8080")
                        green = node(Docker, "API green\n:8081")
            with band("보안 그룹: 5432는 EC2에서만", bgcolor="#eef6ff"):
                db = node(RDS, "RDS PostgreSQL\n공인 접근 꺼짐 · 암호화")
        role = node(IAMRole, "EC2 IAM 역할")
        backup = node(S3, "S3\nDB 백업")

        users >> Edge(label="HTTPS") >> igw >> Edge(label="443") >> proxy
        proxy >> Edge(label="살아 있는 슬롯") >> blue
        proxy >> Edge(label="배포 때 전환", style="dashed") >> green
        blue >> Edge(label="5432 · TLS") >> db
        green >> Edge(style="dashed") >> db
        actions >> Edge(label="이미지 push") >> ghcr
        actions >> Edge(label="SSH 22") >> host
        # 서버가 GHCR에서 받아 온다
        ghcr << Edge(label="이미지 pull", style="dashed") << host
        host >> Edge(style="dotted") >> role >> backup


def blue_green():
    with diagram("blue-green", "Blue-Green 배포: 새 버전이 준비된 뒤에 넘긴다", direction="TB"):
        users = node(Users, "요청")
        proxy = node(Nginx, "Nginx\nupstream 한 줄이\n살아 있는 슬롯을 정한다")
        with band("EC2 한 대"):
            blue = node(Docker, "blue :8080\n옛 버전")
            green = node(Docker, "green :8081\n새 버전")
        db = node(RDS, "PostgreSQL")
        migrate = node(Docker, "migrate")

        users >> proxy
        migrate >> Edge(label="① 스키마 먼저") >> db
        proxy >> Edge(label="전환 전까지 계속 응답") >> blue
        green >> Edge(label="② 쉬는 슬롯에 기동\n③ healthy 확인") >> db
        proxy >> Edge(label="④ upstream 전환 · reload", color="darkgreen", style="bold") >> green
        blue >> Edge(label="⑤ 받던 요청·작업을 끝내고\n⑥ 종료", style="dashed") >> db


def scale_up():
    with diagram("scale-up", "늘릴 때: 설정과 인프라만 바꾼다"):
        users = node(Users, "앱 사용자")
        lb = node(ALB, "ALB")
        with band("서버 2대 이상"):
            api1 = node(NodeJS, "API\nJOB_WORKER_ENABLED=false")
            api2 = node(NodeJS, "API\nJOB_WORKER_ENABLED=false")
            worker = node(NodeJS, "worker\n작업 · 정기 작업")
        cache = node(ElastiCache, "Redis · Valkey\nCACHE_TYPE=redis\n(처음에는 같은 서버의 컨테이너)")
        db = node(RDS, "RDS 한 단계 위\n필요하면 풀러")

        users >> lb
        lb >> api1
        lb >> api2
        api1 >> cache
        api2 >> cache
        worker >> cache
        api1 >> db
        api2 >> db
        worker >> db


if __name__ == "__main__":
    system()
    infra()
    blue_green()
    scale_up()
