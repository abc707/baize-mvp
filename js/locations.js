(function (global) {
  async function loadLocations() {
    const locations = [
      {
        "id": "shanmen",
        "name": "山门",
        "teaser": "朱漆未冷，神兽先至。",
        "audio": "assets/audio/shanmen.wav",
        "narration": "我是白泽。山门之内，万物各有其名。你踏过这道门槛，便把人间的喧嚣留在身后。且立片刻，听风过檐铃，再往前走。"
      },
      {
        "id": "hubian",
        "name": "湖边",
        "teaser": "水光如镜，可照旧事。",
        "audio": "assets/audio/hubian.wav",
        "narration": "湖面不说话，却记得所有倒影。白泽立于岸边，看见你的来路与去处在水纹里轻轻叠在一起。若有未竟之言，可以对着这片水说。"
      },
      {
        "id": "miaoyu",
        "name": "庙宇",
        "teaser": "香火稀疏，神仍在听。",
        "audio": "assets/audio/miaoyu.wav",
        "narration": "梁上旧尘，案前新香。庙宇不是为了催你许愿，只是给你一处把心事放下的地方。白泽在此守着名字与传说，也守着你这一刻的安静。"
      },
      {
        "id": "gucheng",
        "name": "古城门",
        "teaser": "砖石记年，人过留声。",
        "audio": "assets/audio/gucheng.wav",
        "narration": "城门开过千百回，车马与夜雨都从这里进出。白泽拂过墙缝里的青苔，听见旧时鼓角的余韵。你若在此录音，便是把今日也砌进这道门里。"
      },
      {
        "id": "shanlu",
        "name": "山路",
        "teaser": "一步一折，山才肯见。",
        "audio": "assets/audio/shanlu.wav",
        "narration": "山路不直，是怕你走得太急。白泽随行在侧，提醒你看路边的石、树、以及自己的呼吸。停下来录一段，让脚步声也成为故事的一部分。"
      }
    ];
    return locations;
  }

  global.BaizeLocations = { loadLocations };
})(window);