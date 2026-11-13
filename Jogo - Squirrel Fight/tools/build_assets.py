"""
Gera as folhas de sprites usadas pelo jogo (pasta assets/).

Os GIFs originais foram exportados do Pixil com uma "tela" enorme (1600x1600)
e o desenho fica perdido num cantinho dela. Usar esses GIFs direto no HTML faz
os botões aparecerem minúsculos e fora do lugar. Este script:

  1. abre cada GIF e junta todos os quadros (frames);
  2. recorta só a área desenhada (comum a todos os quadros);
  3. salva um PNG com os quadros lado a lado + um assets/sprites.js com os
     tamanhos, para o game.js saber como fatiar.

Uso (dentro da pasta "Jogo - Squirrel Fight"):
    python3 tools/build_assets.py
"""
import json
import os
from PIL import Image, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")

SPRITES = {
    # nome no jogo: caminho do GIF original
    "btnPlay": "Botões/BotãoPlay.gif",
    "btnExit": "Botões/BotãoExit.gif",
    "btnConf": "Botões/botãoConf.gif",
    "btnMenu": "Botões/BotãoMenu.gif",
    "nutCommon": "Animações/SpriteAnimaçãoNozComum.gif",
    "nutGolden": "Animações/SpriteAnimçãoNozDourada.gif",
    "digits": "Sprites de Elementos/SpriteDosNumeros.gif",
    "configMenu": "Sprites de Elementos/SpriteConfiguraçãoTelaInicial.gif",
    "configGame": "Sprites de Elementos/SpriteConfiguraçãoJogo.gif",
    "timerBoard": "Sprites de Elementos/PlacarDoTemporizador.gif",
    "sashLose": "Sprites de Elementos/SpriteFaixaDeDerrota.pixil.gif",
    "sashWin": "Sprites de Elementos/SpriteFaixaDeVitoria.gif",
    "counter1": "Sprites de Elementos/ContagemDasNozesEsquilo1.gif",
    "counter2": "Sprites de Elementos/ContagemDasNozesEsquilo2.gif",
    "crown": "Sprites de Elementos/SpriteCoroa.gif",
    "tutorialBoard": "Cenários/Sprites do Cenário/SpriteTutorial.gif",
    "background": "Cenários/Sprites do Cenário/SpriteFundo.gif",
    "platforms": "Cenários/Sprites do Cenário/SpritePlataforma.gif",
    "p1Idle": "Animações/AnimaçõesEsquilo1/AnimaçãoParadoEsquilo1.gif",
    "p1Walk": "Animações/AnimaçõesEsquilo1/AnimaçãoAndarEsquilo1.gif",
    "p1Jump": "Animações/AnimaçõesEsquilo1/AnimaçãoPularEsquilo1.gif",
    "p1Win": "Animações/AnimaçõesEsquilo1/AnimaçãoVitoriaEsquilo1.gif",
    "p1Lose": "Animações/AnimaçõesEsquilo1/AnimaçãoDerrotaEsquilo1.gif",
    "p2Idle": "Animações/AnimaçõesEsquilo2/AnimaçaoParadoEsquilo2.gif",
    "p2Walk": "Animações/AnimaçõesEsquilo2/AnimaçaoAndarEsquilo2 (2).gif",
    "p2Jump": "Animações/AnimaçõesEsquilo2/AnimaçãoPularEsquilo2.gif",
    "p2Win": "Animações/AnimaçõesEsquilo2/AnimaçaoVitoriaEsquilo2.gif",
    "p2Lose": "Animações/AnimaçõesEsquilo2/AnimaçaoDerrotaEsquilo2.gif",
}

# Sprites que ocupam a tela toda (200x200) e não devem ser recortados.
FULL_SCREEN = {"background", "platforms"}


def load_frames(path):
    img = Image.open(path)
    frames, delays = [], []
    for frame in ImageSequence.Iterator(img):
        frames.append(frame.convert("RGBA").copy())
        delays.append(frame.info.get("duration", 100) or 100)
    return frames, delays


def union_bbox(frames):
    box = None
    for f in frames:
        b = f.getchannel("A").getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
    return box


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for name, rel in SPRITES.items():
        frames, delays = load_frames(os.path.join(ROOT, rel))
        if name in FULL_SCREEN:
            box = (0, 0) + frames[0].size
        else:
            box = union_bbox(frames)
        cropped = [f.crop(box) for f in frames]
        fw, fh = cropped[0].size
        sheet = Image.new("RGBA", (fw * len(cropped), fh), (0, 0, 0, 0))
        for i, f in enumerate(cropped):
            sheet.paste(f, (i * fw, 0))
        sheet.save(os.path.join(OUT, name + ".png"))
        meta[name] = {"w": fw, "h": fh, "frames": len(cropped), "delays": delays}
        print(f"{name:14s} {fw}x{fh} x{len(cropped)}")

    # Fundo do menu: a "Tela Inicial" (1200x1200 = 6x) reduzida para 200x200,
    # com a área dos botões apagada (os botões de verdade são desenhados por cima
    # pelo jogo, para poderem ser clicados e animar).
    tela = Image.open(os.path.join(ROOT, "Cenários/Tela Inicial - Squirrel Fight.png")).convert("RGBA")
    tela = tela.resize((200, 200), Image.NEAREST)
    fundo = Image.open(os.path.join(ROOT, SPRITES["background"])).convert("RGBA")
    area = (78, 68, 122, 156)
    tela.paste(fundo.crop(area), area[:2])
    tela.save(os.path.join(OUT, "menuBg.png"))
    meta["menuBg"] = {"w": 200, "h": 200, "frames": 1, "delays": [100]}

    with open(os.path.join(OUT, "sprites.js"), "w", encoding="utf-8") as fp:
        fp.write("// Arquivo gerado por tools/build_assets.py - não editar à mão.\n")
        fp.write("const SPRITE_META = " + json.dumps(meta) + ";\n")


if __name__ == "__main__":
    main()
