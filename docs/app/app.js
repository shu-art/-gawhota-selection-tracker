let pokemon = [];
let items = {};
let abilities = {};
let moves = {};
let selected = [];

const app = document.getElementById("app");

function imagePath(p) {
  return `../assets/pokemon/${p.asset}`;
}

function itemImagePath(item) {
  if (!item?.asset) return "";

  return (
    "../assets/items/" +
    encodeURIComponent(item.asset)
  );
}

function normalizeMasterText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
}

function findMasterEntry(master, value) {
  if (!value) return null;

  /*
   * 将来的に保存値をMaster IDへ移行しても
   * 同じ関数で読めるようにする。
   */
  if (master[value]) {
    return {
      id: value,
      ...master[value]
    };
  }

  const needle =
    normalizeMasterText(value);

  for (const [id, entry] of Object.entries(master)) {
    const candidates = [
      id,
      entry?.name?.en,
      entry?.name?.ja,
      entry?.name_en,
      entry?.name_ja,
      entry?.display_name
    ]
      .filter(Boolean)
      .map(normalizeMasterText);

    if (candidates.includes(needle)) {
      return {
        id,
        ...entry
      };
    }
  }

  return null;
}

function getAbilityMaster(value) {
  return findMasterEntry(
    abilities,
    value
  );
}

function getMoveMaster(value) {
  return findMasterEntry(
    moves,
    value
  );
}

function getAbilityDisplayName(value) {
  const entry =
    getAbilityMaster(value);

  return (
    entry?.name?.ja ||
    entry?.name_ja ||
    value ||
    ""
  );
}

function getMoveDisplayName(value) {
  const entry =
    getMoveMaster(value);

  return (
    entry?.name?.ja ||
    entry?.name_ja ||
    value ||
    ""
  );
}

function getAbilityId(value) {
  return (
    getAbilityMaster(value)?.id ||
    ""
  );
}

function getMoveId(value) {
  return (
    getMoveMaster(value)?.id ||
    ""
  );
}

/* =========================
   Storage
========================= */

function getParties() {
  return JSON.parse(localStorage.getItem("gawhota_parties") || "[]");
}

function saveParties(parties) {
  localStorage.setItem("gawhota_parties", JSON.stringify(parties));
}

function getMatches() {
  return JSON.parse(localStorage.getItem("gawhota_matches") || "[]");
}

function saveMatches(matches) {
  localStorage.setItem("gawhota_matches", JSON.stringify(matches));
}

function draftKey(partyId) {
  return `gawhota_match_draft_${partyId}`;
}

function saveDraft(partyId, draft) {
  localStorage.setItem(draftKey(partyId), JSON.stringify(draft));
}

function loadDraft(partyId) {
  const raw = localStorage.getItem(draftKey(partyId));
  return raw ? JSON.parse(raw) : null;
}

function clearDraft(partyId) {
  localStorage.removeItem(draftKey(partyId));
}

/* =========================
   Boot
========================= */

async function loadData() {
  const [
    pokemonRes,
    itemsRes,
    abilitiesRes,
    movesRes
  ] = await Promise.all([
    fetch("../data/pokemon.json"),
    fetch("../data/items.json"),
    fetch("../data/abilities.json"),
    fetch("../data/moves.json")
  ]);

  pokemon =
    await pokemonRes.json();

  items =
    await itemsRes.json();

  abilities =
    await abilitiesRes.json();

  moves =
    await movesRes.json();

  showPartyList();
}

/* =========================
   Party list
========================= */

function showPartyList() {
  selected = [];

  const parties = getParties();

  app.innerHTML = `
    <h1 class="page-title">構築一覧</h1>

    <div class="toolbar">
      <button id="newParty" class="primary-button">
        ＋ 新しい構築を登録
      </button>
    </div>

    <section class="section">
      <div id="partyList" class="party-list"></div>
    </section>
  `;

  document
    .getElementById("newParty")
    .addEventListener("click", showPartyEditor);

  const list = document.getElementById("partyList");

  if (parties.length === 0) {
    list.innerHTML = `
      <div class="empty">
        まだ構築が登録されていません。
      </div>
    `;
    return;
  }

  parties
    .slice()
    .reverse()
    .forEach(party => {
      const matches = getMatches()
        .filter(m => m.party_id === party.id);

      const wins = matches
        .filter(m => m.result === "win").length;

      const losses = matches
        .filter(m => m.result === "loss").length;

      const row = document.createElement("div");
      row.className = "party-row";

      const icons = party.pokemon.map(p => `
        <img
          src="${imagePath(p)}"
          alt="${escapeHtml(p.display_name)}"
        >
      `).join("");

      row.innerHTML = `
        <div class="party-info">
          <div class="party-name">
            ${escapeHtml(party.name)}
          </div>

          <div class="party-icons">
            ${icons}
          </div>

          <div class="party-record">
            ${matches.length}戦　
            ${wins}勝 ${losses}敗
          </div>
        </div>
      `;

      row.addEventListener("click", () => {
        showPartyDetail(party.id);
      });

      list.appendChild(row);
    });
}

/* =========================
   Party editor
========================= */

function showPartyEditor(partyId = null) {
  const parties = getParties();

  const existingParty =
    partyId
      ? parties.find(p => p.id === partyId)
      : null;

  /*
   * 既存構築はコピーして編集する。
   * item_idが無い旧データにも対応。
   */
  selected =
    existingParty
      ? (existingParty.pokemon || []).map(p => ({
          ...p,
          item_id: p.item_id || null
        }))
      : [];

  app.innerHTML = `
    <h1 class="page-title">
      ${existingParty ? "構築を編集" : "新しい構築"}
    </h1>

    <section class="section">
      <h2 class="section-title">構築名</h2>

      <input
        id="partyName"
        type="text"
        placeholder="例：Reg M 世界大会候補"
        autocomplete="off"
        value="${
          existingParty
            ? escapeHtml(existingParty.name)
            : ""
        }"
      >
    </section>

    <section class="section">
      <h2 class="section-title">Pokepasteから反映</h2>

      <p class="section-help">
        Pokepaste / Showdown形式の本文を貼り付けると、
        ポケモン・フォーム・持ち物を6匹まとめて反映します。
      </p>

      <textarea
        id="pokepasteInput"
        class="pokepaste-input"
        rows="8"
        placeholder="Charizard-Mega-Y @ Charizardite Y&#10;Ability: Drought&#10;...&#10;&#10;Incineroar @ Sitrus Berry&#10;..."
      ></textarea>

      <div class="toolbar">
        <button
          id="applyPokepaste"
          type="button"
          class="secondary-button">
          Pokepasteから反映
        </button>
      </div>

      <div
        id="pokepasteMessage"
        class="pokepaste-message">
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">選択中</h2>

      <div class="counter">
        <span id="count">${selected.length}</span> / 6
      </div>

      <div
        id="selectedArea"
        class="selected-area">
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">ポケモンを追加</h2>

      <div class="toolbar">
        <input
          id="search"
          type="search"
          placeholder="ポケモン名を検索"
          autocomplete="off"
        >
      </div>

      <div id="results" class="grid"></div>
    </section>

    <div class="actions">
      <button
        id="cancel"
        class="secondary-button">
        戻る
      </button>

      <button
        id="saveParty"
        class="primary-button"
        disabled>
        ${existingParty ? "変更を保存" : "構築を保存"}
      </button>
    </div>
  `;

  document
    .getElementById("cancel")
    .addEventListener(
      "click",
      () => {
        if (existingParty) {
          showPartyDetail(existingParty.id);
        } else {
          showPartyList();
        }
      }
    );

  document
    .getElementById("search")
    .addEventListener("input", e => {
      renderResults(e.target.value);
    });

  document
    .getElementById("partyName")
    .addEventListener(
      "input",
      updateSaveButton
    );

  document
    .getElementById("applyPokepaste")
    .addEventListener(
      "click",
      applyPokepasteToParty
    );

  document
    .getElementById("saveParty")
    .addEventListener(
      "click",
      () => saveCurrentParty(existingParty)
    );

  renderSelected();
  renderResults("");
  updateSaveButton();
}

function toShowdownId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getPartyItemName(itemId) {
  const item = items[itemId];

  if (!item) return itemId || "";

  return (
    item.name?.ja ||
    item.name?.en ||
    item.display_name ||
    itemId
  );
}

function findPokemonFromPaste(name) {
  const target =
    toShowdownId(name);

  if (!target) return null;

  /*
   * Pokepasteではフォーム情報を失わないことが重要。
   *
   * 1. id
   * 2. display_name
   * 3. species_id
   *
   * の順で照合する。
   */

  const idMatch =
    pokemon.find(p =>
      toShowdownId(p.id) === target
    );

  if (idMatch) {
    return idMatch;
  }

  const displayMatch =
    pokemon.find(p =>
      toShowdownId(p.display_name) === target
    );

  if (displayMatch) {
    return displayMatch;
  }

  const speciesMatch =
    pokemon.find(p =>
      toShowdownId(p.species_id) === target
    );

  return speciesMatch || null;
}

function findItemFromPaste(name) {
  const target =
    toShowdownId(name);

  if (!target) return null;

  for (const [itemId, item] of Object.entries(items)) {
    const candidates = [
      itemId,
      item.name?.en,
      item.name?.ja,
      item.display_name
    ]
      .filter(Boolean)
      .map(toShowdownId);

    if (candidates.includes(target)) {
      return itemId;
    }
  }

  /*
   * Pokepaste側とMaster側で
   * ハイフン等の表記差がある場合も再照合。
   */
  for (const [itemId, item] of Object.entries(items)) {
    if (
      toShowdownId(itemId) === target ||
      toShowdownId(item.name?.en) === target
    ) {
      return itemId;
    }
  }

  return null;
}

function parsePokepaste(text) {
  /*
   * Showdown/Pokepasteは空行で1匹ずつ分かれる。
   * 今回UIで使うのはspecies/form + item。
   *
   * rawは将来 Ability / EV / IV / Nature / Moves を
   * 利用するときのため保持可能な形にしておく。
   */
  const blocks =
    String(text || "")
      .replace(/\r/g, "")
      .split(/\n\s*\n/)
      .map(x => x.trim())
      .filter(Boolean);

  const parsed = [];

  blocks.forEach(block => {
    const lines =
      block
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

    if (!lines.length) return;

    const firstLine = lines[0];

    let pokemonName = firstLine;
    let itemName = "";

    if (firstLine.includes(" @ ")) {
      const parts =
        firstLine.split(" @ ");

      pokemonName =
        parts[0].trim();

      itemName =
        parts.slice(1).join(" @ ").trim();
    }

    /*
     * Showdownの末尾の性別表記を先に除去する。
     *
     * Floette-Mega (F)
     * Incineroar (M)
     */
    pokemonName =
      pokemonName
        .replace(/\s+\((?:M|F)\)\s*$/i, "")
        .trim();

    /*
     * ニックネーム付きの場合だけ、
     * 括弧内を実際のポケモン名として扱う。
     *
     * Nickname (Garchomp)
     */
    const nicknameMatch =
      pokemonName.match(/^.+\s+\(([^()]+)\)\s*$/);

    if (nicknameMatch) {
      pokemonName =
        nicknameMatch[1].trim();
    }

    parsed.push({
      pokemon_name: pokemonName,
      item_name: itemName,
      raw: block
    });
  });

  /*
   * Pokepasteの各ポケモンについて、
   * 選出記録以外でも使える詳細情報を構造化して保持する。
   */
  parsed.forEach(entry => {
    const lines =
      String(entry.raw || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const detail = {
      ability: null,
      nature: null,
      level: 50,

      evs: {
        hp: 0,
        atk: 0,
        def: 0,
        spa: 0,
        spd: 0,
        spe: 0
      },

      ivs: {
        hp: 31,
        atk: 31,
        def: 31,
        spa: 31,
        spd: 31,
        spe: 31
      },

      moves: []
    };

    const statMap = {
      HP: "hp",
      Atk: "atk",
      Def: "def",
      SpA: "spa",
      SpD: "spd",
      Spe: "spe"
    };

    const parseStats = value => {
      const result = {};

      value
        .split("/")
        .map(part => part.trim())
        .forEach(part => {
          const match =
            part.match(
              /^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i
            );

          if (!match) {
            return;
          }

          const canonical =
            Object.keys(statMap)
              .find(
                key =>
                  key.toLowerCase() ===
                  match[2].toLowerCase()
              );

          if (!canonical) {
            return;
          }

          result[statMap[canonical]] =
            Number(match[1]);
        });

      return result;
    };

    lines.slice(1).forEach(line => {
      let match;

      if (
        (match =
          line.match(/^Ability:\s*(.+)$/i))
      ) {
        detail.ability =
          match[1].trim();
        return;
      }

      if (
        (match =
          line.match(/^Level:\s*(\d+)$/i))
      ) {
        detail.level =
          Number(match[1]);
        return;
      }

      if (
        (match =
          line.match(/^EVs:\s*(.+)$/i))
      ) {
        Object.assign(
          detail.evs,
          parseStats(match[1])
        );
        return;
      }

      if (
        (match =
          line.match(/^IVs:\s*(.+)$/i))
      ) {
        Object.assign(
          detail.ivs,
          parseStats(match[1])
        );
        return;
      }

      if (
        (match =
          line.match(/^(.+?)\s+Nature$/i))
      ) {
        detail.nature =
          match[1].trim();
        return;
      }

      if (
        (match =
          line.match(/^-\s*(.+)$/))
      ) {
        if (detail.moves.length < 4) {
          detail.moves.push(
            match[1].trim()
          );
        }
      }
    });

    entry.ability =
      detail.ability;

    entry.nature =
      detail.nature;

    entry.level =
      detail.level;

    entry.evs =
      detail.evs;

    entry.ivs =
      detail.ivs;

    entry.moves =
      detail.moves;
  });

  return parsed;
}

async function applyPokepasteToParty() {
  const input =
    document.getElementById(
      "pokepasteInput"
    );

  const message =
    document.getElementById(
      "pokepasteMessage"
    );

  let source =
    input.value.trim();

  if (!source) {
    message.textContent =
      "PokepasteのURLまたは本文を入力してください。";
    return;
  }

  /*
   * URLならMac側のSelection Trackerサーバーへ依頼。
   * 本文なら従来通りそのまま解析する。
   */
  if (
    /^https?:\/\/(?:www\.)?pokepast\.es\//i.test(source)
  ) {
    message.textContent =
      "Pokepasteを読み込み中…";

    try {
      const response =
        await fetch(
          "/api/pokepaste?url=" +
          encodeURIComponent(source)
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok ||
        !data.text
      ) {
        throw new Error(
          data.error ||
          "Pokepaste fetch failed"
        );
      }

      source = data.text;

    } catch (error) {
      console.error(
        "Pokepaste URL import:",
        error
      );

      message.textContent =
        "Pokepaste URLを取得できませんでした。";

      return;
    }
  }

  const parsed =
    parsePokepaste(source);

  if (!parsed.length) {
    message.textContent =
      "Pokepasteの内容を読み取れませんでした.";
    return;
  }

  const imported = [];
  const errors = [];

  parsed
    .slice(0, 6)
    .forEach(entry => {
      const p =
        findPokemonFromPaste(
          entry.pokemon_name
        );

      if (!p) {
        errors.push(
          `ポケモン不明: ${entry.pokemon_name}`
        );
        return;
      }

      let itemId = null;

      if (entry.item_name) {
        itemId =
          findItemFromPaste(
            entry.item_name
          );

        if (!itemId) {
          errors.push(
            `持ち物不明: ${entry.item_name}`
          );
        }
      }

      imported.push({
        id: p.id,
        species_id: p.species_id,
        display_name: p.display_name,
        asset: p.asset,
        item_id: itemId,

        /*
         * Pokepaste詳細情報。
         * 表示だけでなく、将来の実数値計算や
         * 選出分析にも利用できる形で保持する。
         */
        ability: entry.ability || null,
        nature: entry.nature || null,
        level: entry.level || 50,

        evs: {
          hp: entry.evs?.hp ?? 0,
          atk: entry.evs?.atk ?? 0,
          def: entry.evs?.def ?? 0,
          spa: entry.evs?.spa ?? 0,
          spd: entry.evs?.spd ?? 0,
          spe: entry.evs?.spe ?? 0
        },

        ivs: {
          hp: entry.ivs?.hp ?? 31,
          atk: entry.ivs?.atk ?? 31,
          def: entry.ivs?.def ?? 31,
          spa: entry.ivs?.spa ?? 31,
          spd: entry.ivs?.spd ?? 31,
          spe: entry.ivs?.spe ?? 31
        },

        moves:
          Array.isArray(entry.moves)
            ? entry.moves.slice(0, 4)
            : [],

        /*
         * 解析方法を後から変更しても復元できるよう
         * Pokepasteの元ブロックも保持する。
         */
        pokepaste_raw: entry.raw
      });
    });

  if (!imported.length) {
    message.textContent =
      errors.join(" / ") ||
      "反映できるポケモンがありませんでした。";
    return;
  }

  selected =
    imported.slice(0, 6);

  renderSelected();
  renderResults(
    document.getElementById("search").value
  );
  updateSaveButton();

  if (errors.length) {
    message.textContent =
      `${selected.length}匹反映 / ${errors.join(" / ")}`;
  } else {
    message.textContent =
      `${selected.length}匹を反映しました。`;
  }
}

function renderSelected() {
  const area =
    document.getElementById(
      "selectedArea"
    );

  const count =
    document.getElementById(
      "count"
    );

  if (!area || !count) return;

  count.textContent =
    String(selected.length);

  area.innerHTML = "";

  selected.forEach(p => {
    const card =
      document.createElement("div");

    card.className =
      "party-selected-card";

    const item =
      p.item_id
        ? items[p.item_id]
        : null;

    card.innerHTML = `
      <div class="party-selected-main">
        <img
          class="party-selected-pokemon"
          src="${imagePath(p)}"
          alt="${escapeHtml(p.display_name)}"
        >

        <div class="party-selected-info">
          <strong>
            ${escapeHtml(p.display_name)}
          </strong>

          <button
            type="button"
            class="party-item-button">
            ${
              item
                ? `
                  ${
                    item.asset
                      ? `
                        <img
                          src="${itemImagePath(item)}"
                          alt=""
                        >
                      `
                      : ""
                  }
                  ${escapeHtml(
                    getPartyItemName(p.item_id)
                  )}
                `
                : "持ち物を設定"
            }
          </button>
        </div>

        <button
          type="button"
          class="party-remove-button"
          aria-label="削除">
          ×
        </button>
      </div>
    `;

    card
      .querySelector(".party-remove-button")
      .addEventListener(
        "click",
        event => {
          event.stopPropagation();

          selected =
            selected.filter(
              x => x.id !== p.id
            );

          renderSelected();

          renderResults(
            document
              .getElementById("search")
              .value
          );

          updateSaveButton();
        }
      );

    card
      .querySelector(".party-item-button")
      .addEventListener(
        "click",
        event => {
          event.stopPropagation();

          openPartyItemPicker(p.id);
        }
      );

    area.appendChild(card);
  });
}

function openPartyItemPicker(pokemonId) {
  const target =
    selected.find(
      p => p.id === pokemonId
    );

  if (!target) return;

  const overlay =
    document.createElement("div");

  overlay.className =
    "revealed-editor-overlay";

  overlay.innerHTML = `
    <div class="revealed-editor-panel party-item-picker">
      <div class="party-item-picker-header">
        <div>
          <div class="form-picker-subtitle">
            持ち物を設定
          </div>

          <h2>
            ${escapeHtml(target.display_name)}
          </h2>
        </div>

        <button
          type="button"
          class="party-item-close party-item-close-top"
          aria-label="閉じる">
          ×
        </button>
      </div>

      <input
        class="party-item-search"
        type="search"
        placeholder="持ち物名を検索"
        autocomplete="off"
      >

      <div
        class="party-item-results">
      </div>

      <div class="actions">
        <button
          type="button"
          class="secondary-button party-item-none">
          持ち物なし
        </button>


      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const search =
    overlay.querySelector(
      ".party-item-search"
    );

  const results =
    overlay.querySelector(
      ".party-item-results"
    );

  function renderItemResults(query) {
    results.innerHTML = "";

    const q =
      String(query || "")
        .trim()
        .toLowerCase();

    /*
     * 空欄でも候補を少し表示。
     * 入力時は日本語/英語/IDから検索。
     */
    const matches =
      Object.entries(items)
        .filter(([id, item]) => {
          if (!q) return true;

          return [
            id,
            item.name?.ja,
            item.name?.en,
            item.display_name
          ].some(value =>
            String(value || "")
              .toLowerCase()
              .includes(q)
          );
        })
        .slice(0, 20);

    matches.forEach(([id, item]) => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "party-item-option";

      if (id === target.item_id) {
        button.classList.add("selected");
      }

      button.innerHTML = `
        ${
          item.asset
            ? `
              <img
                src="${itemImagePath(item)}"
                alt=""
              >
            `
            : ""
        }

        <span>
          ${escapeHtml(
            getPartyItemName(id)
          )}
        </span>

        ${
          id === target.item_id
            ? "<strong>✓</strong>"
            : ""
        }
      `;

      button.addEventListener(
        "click",
        () => {
          target.item_id = id;

          overlay.remove();

          renderSelected();
          updateSaveButton();
        }
      );

      results.appendChild(button);
    });
  }

  search.addEventListener(
    "input",
    () => {
      renderItemResults(
        search.value
      );
    }
  );

  overlay
    .querySelector(".party-item-none")
    .addEventListener(
      "click",
      () => {
        target.item_id = null;

        overlay.remove();

        renderSelected();
        updateSaveButton();
      }
    );

  overlay
    .querySelector(".party-item-close")
    .addEventListener(
      "click",
      () => overlay.remove()
    );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    }
  );

  renderItemResults("");
  search.focus();
}

function renderResults(query) {
  const results =
    document.getElementById("results");

  if (!results) return;

  results.innerHTML = "";

  const q =
    String(query || "").trim();

  if (!q) return;

  const groups =
    filterSpeciesGroups(
      pokemon,
      q
    );

  groups
    .slice(0, 10)
    .forEach(group => {
      const card =
        createSpeciesCard(
          group,
          {
            selectedIds:
              selected.map(p => p.id),

            onSelect: p => {
              togglePokemon(p);
            }
          }
        );

      if (card) {
        results.appendChild(card);
      }
    });
}

function togglePokemon(p) {
  const exists =
    selected.some(x => x.id === p.id);

  if (exists) {
    selected =
      selected.filter(
        x => x.id !== p.id
      );
  } else {
    if (selected.length >= 6) return;

    selected.push({
      ...p,
      item_id: p.item_id || null
    });
  }

  renderSelected();

  renderResults(
    document
      .getElementById("search")
      .value
  );

  updateSaveButton();
}

function updateSaveButton() {
  const button =
    document.getElementById(
      "saveParty"
    );

  const nameInput =
    document.getElementById(
      "partyName"
    );

  if (!button || !nameInput) return;

  button.disabled =
    selected.length !== 6 ||
    nameInput.value.trim() === "";
}

function saveCurrentParty(existingParty = null) {
  const name =
    document
      .getElementById("partyName")
      .value
      .trim();

  if (
    !name ||
    selected.length !== 6
  ) {
    return;
  }

  const parties =
    getParties();

  const party = {
    id:
      existingParty?.id ||
      `party_${Date.now()}`,

    name,

    created_at:
      existingParty?.created_at ||
      new Date().toISOString(),

    updated_at:
      new Date().toISOString(),

    version:
      (existingParty?.version || 0) + 1,

    pokemon:
      selected.map(p => ({
        id: p.id,
        species_id: p.species_id,
        display_name: p.display_name,
        asset: p.asset,
        item_id: p.item_id || null,

        ...(p.pokepaste_raw
          ? {
              pokepaste_raw:
                p.pokepaste_raw
            }
          : {})
      }))
  };

  if (existingParty) {
    const index =
      parties.findIndex(
        p => p.id === existingParty.id
      );

    if (index === -1) return;

    parties[index] = party;
  } else {
    parties.push(party);
  }

  saveParties(parties);

  showPartyDetail(party.id);
}

/* =========================
   Party detail
========================= */



function openDetailPokemonPicker(
  partyId,
  slotIndex,
  currentOverlay
) {
  const overlay =
    document.createElement("div");

  overlay.className =
    "revealed-editor-overlay";

  overlay.innerHTML = `
    <div class="revealed-editor-panel detail-picker-panel">

      <div class="detail-picker-header">
        <h2>ポケモンを変更</h2>

        <button
          type="button"
          class="detail-picker-close">
          ×
        </button>
      </div>

      <input
        type="search"
        class="detail-picker-search"
        placeholder="ポケモン名を検索">

      <div class="detail-picker-results"></div>

    </div>
  `;

  document.body.appendChild(overlay);

  const search =
    overlay.querySelector(
      ".detail-picker-search"
    );

  const results =
    overlay.querySelector(
      ".detail-picker-results"
    );

  const render = () => {
    const query =
      normalizeLookupText(
        search.value
      );

    let candidates =
      pokemon.filter(p => {
        if (!query) return true;

        const values = [
          p.id,
          p.display_name,
          p.name,
          p.name_ja,
          p.name_en
        ]
          .filter(Boolean)
          .map(normalizeLookupText);

        return values.some(
          value => value.includes(query)
        );
      });

    candidates =
      candidates.slice(0, 80);

    results.innerHTML =
      candidates.map(candidate => `
        <button
          type="button"
          class="detail-picker-pokemon"
          data-id="${escapeHtml(candidate.id)}">

          <img
            src="${imagePath(candidate)}"
            alt="">

          <span>
            ${escapeHtml(
              candidate.display_name ||
              candidate.name_ja ||
              candidate.name ||
              candidate.id
            )}
          </span>
        </button>
      `).join("");

    results
      .querySelectorAll(
        ".detail-picker-pokemon"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const candidate =
              pokemon.find(
                value =>
                  value.id === button.dataset.id
              );

            if (!candidate) return;

            const parties =
              getParties();

            const partyIndex =
              parties.findIndex(
                party =>
                  party.id === partyId
              );

            if (
              partyIndex === -1 ||
              !parties[partyIndex]
                .pokemon[slotIndex]
            ) {
              return;
            }

            /*
             * スロットは維持。
             * ポケモン変更時には旧ポケモンの
             * 型情報を引き継がない。
             */
            const next = {
              id: candidate.id,
              species_id:
                candidate.species_id ||
                candidate.id,

              display_name:
                candidate.display_name ||
                candidate.name_ja ||
                candidate.name ||
                candidate.id,

              asset:
                candidate.asset || null,

              item_id: null,
              ability: null,
              nature: null,
              level: 50,

              evs: {
                hp: 0,
                atk: 0,
                def: 0,
                spa: 0,
                spd: 0,
                spe: 0
              },

              moves: [],
              pokepaste_raw: null
            };

            parties[partyIndex]
              .pokemon[slotIndex] = next;

            saveParties(parties);

            overlay.remove();

            if (currentOverlay) {
              currentOverlay.remove();
            }

            openPartyPokemonDetail(
              next,
              partyId,
              slotIndex
            );
          }
        );
      });
  };

  search.addEventListener(
    "input",
    render
  );

  overlay
    .querySelector(
      ".detail-picker-close"
    )
    .addEventListener(
      "click",
      () => overlay.remove()
    );

  render();

  setTimeout(
    () => search.focus(),
    50
  );
}


function openDetailItemPicker(
  partyId,
  slotIndex,
  currentOverlay
) {
  const overlay =
    document.createElement("div");

  overlay.className =
    "revealed-editor-overlay";

  overlay.innerHTML = `
    <div class="revealed-editor-panel detail-picker-panel">

      <div class="detail-picker-header">
        <h2>持ち物を変更</h2>

        <button
          type="button"
          class="detail-picker-close">
          ×
        </button>
      </div>

      <input
        type="search"
        class="detail-picker-search"
        placeholder="持ち物名を検索">

      <div class="detail-picker-results"></div>

    </div>
  `;

  document.body.appendChild(overlay);

  const search =
    overlay.querySelector(
      ".detail-picker-search"
    );

  const results =
    overlay.querySelector(
      ".detail-picker-results"
    );

  const render = () => {
    const query =
      normalizeLookupText(
        search.value
      );

    const candidates =
      Object.values(items)
        .filter(item => {
          if (!query) return true;

          const values = [
            item.id,
            item.name?.ja,
            item.name?.en,
            item.name_ja,
            item.name_en,
            item.display_name
          ]
            .filter(Boolean)
            .map(normalizeLookupText);

          return values.some(
            value => value.includes(query)
          );
        })
        .slice(0, 100);

    results.innerHTML =
      candidates.map(item => `
        <button
          type="button"
          class="detail-picker-item"
          data-id="${escapeHtml(item.id)}">

          ${
            item.asset
              ? `
                <img
                  src="${itemImagePath(item)}"
                  alt="">
              `
              : ""
          }

          <span>
            ${escapeHtml(
              item.name?.ja ||
              item.name_ja ||
              item.display_name ||
              item.name?.en ||
              item.name_en ||
              item.id
            )}
          </span>
        </button>
      `).join("");

    results
      .querySelectorAll(
        ".detail-picker-item"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const parties =
              getParties();

            const partyIndex =
              parties.findIndex(
                party =>
                  party.id === partyId
              );

            if (
              partyIndex === -1 ||
              !parties[partyIndex]
                .pokemon[slotIndex]
            ) {
              return;
            }

            parties[partyIndex]
              .pokemon[slotIndex]
              .item_id =
                button.dataset.id;

            saveParties(parties);

            const saved =
              parties[partyIndex]
                .pokemon[slotIndex];

            overlay.remove();

            if (currentOverlay) {
              currentOverlay.remove();
            }

            openPartyPokemonDetail(
              saved,
              partyId,
              slotIndex
            );
          }
        );
      });
  };

  search.addEventListener(
    "input",
    render
  );

  overlay
    .querySelector(
      ".detail-picker-close"
    )
    .addEventListener(
      "click",
      () => overlay.remove()
    );

  render();

  setTimeout(
    () => search.focus(),
    50
  );
}


function openPartyPokemonDetail(p, partyId, slotIndex) {
  const overlay = document.createElement("div");
  overlay.className = "revealed-editor-overlay";

  const statLabels = {
    hp: "HP",
    atk: "攻撃",
    def: "防御",
    spa: "特攻",
    spd: "特防",
    spe: "素早さ"
  };

  const statKeys = [
    "hp", "atk", "def",
    "spa", "spd", "spe"
  ];

  const evs = p.evs || {};
  const moves = Array.isArray(p.moves)
    ? [...p.moves]
    : [];

  while (moves.length < 4) {
    moves.push("");
  }

  const itemName =
    p.item_id && items[p.item_id]
      ? getPartyItemName(p.item_id)
      : "未設定";

  const presetKey =
    "gawhota_pokemon_presets";

  const getPresets = () => {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(presetKey) || "[]"
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  };

  const speciesPresets =
    getPresets().filter(
      preset =>
        preset.species_id === p.species_id
    );

  overlay.innerHTML = `
    <div class="revealed-editor-panel party-pokemon-detail">

      <div class="party-pokemon-detail-header">
        <div class="party-pokemon-detail-title">

          <button
            type="button"
            class="party-pokemon-change-button"
            title="ポケモンを変更">

            <img src="${imagePath(p)}" alt="">

            <div>
              <h2>
                ${escapeHtml(p.display_name || "")}
                <span class="party-edit-chevron">›</span>
              </h2>
            </div>
          </button>

          <div>
            <button
              type="button"
              class="party-pokemon-item-change-button"
              title="持ち物を変更">

              <div class="party-pokemon-detail-item-line">
              ${
                p.item_id &&
                items[p.item_id]?.asset
                  ? `
                    <img
                      src="${itemImagePath(items[p.item_id])}"
                      alt=""
                    >
                  `
                  : ""
              }

                <span>
                  ${escapeHtml(itemName)}
                  <span class="party-edit-chevron">›</span>
                </span>
              </div>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="party-pokemon-detail-close"
          aria-label="閉じる">
          ×
        </button>
      </div>

      <div class="party-pokemon-edit-basic">

        <label>
          <span>特性</span>
          <input
            class="pokemon-edit-ability"
            type="text"
            value="${escapeHtml(p.ability || "")}">
        </label>

        <label>
          <span>性格</span>
          <input
            class="pokemon-edit-nature"
            type="text"
            value="${escapeHtml(p.nature || "")}">
        </label>

        <label>
          <span>Lv.</span>
          <input
            class="pokemon-edit-level"
            type="number"
            min="1"
            max="100"
            value="${escapeHtml(String(p.level || 50))}">
        </label>

      </div>

      <div class="party-pokemon-detail-section">
        <h3>能力ポイント</h3>

        <div class="party-pokemon-edit-stat-grid">
          ${statKeys.map(key => `
            <label>
              <span>${statLabels[key]}</span>

              <input
                type="number"
                min="0"
                class="pokemon-edit-stat"
                data-stat="${key}"
                value="${evs[key] ?? 0}">
            </label>
          `).join("")}
        </div>
      </div>

      <div class="party-pokemon-detail-section">
        <h3>技</h3>

        <div class="party-pokemon-edit-moves">
          ${moves.slice(0, 4).map((move, index) => `
            <input
              type="text"
              class="pokemon-edit-move"
              data-move-index="${index}"
              value="${escapeHtml(move)}"
              placeholder="技${index + 1}">
          `).join("")}
        </div>
      </div>

      <div class="party-pokemon-main-save">
        <div
          class="party-pokemon-save-message"
          aria-live="polite">
        </div>

        <button
          type="button"
          class="primary-button party-pokemon-direct-save">
          変更を保存
        </button>
      </div>


      <div class="party-pokemon-detail-section party-pokemon-preset-section">
        <h3>プリセット</h3>

        ${
          speciesPresets.length
            ? `
              <div class="party-pokemon-preset-load">
                <select class="party-pokemon-preset-select">
                  <option value="">
                    プリセットを選択
                  </option>

                  ${speciesPresets.map(preset => `
                    <option value="${escapeHtml(preset.id)}">
                      ${escapeHtml(preset.name)}
                    </option>
                  `).join("")}
                </select>

                <button
                  type="button"
                  class="party-pokemon-preset-apply">
                  呼び出す
                </button>
              </div>
            `
            : `
              <div class="party-pokemon-preset-empty">
                このポケモンのプリセットはまだありません
              </div>
            `
        }

        <div class="party-pokemon-preset-save">
          <input
            type="text"
            class="party-pokemon-preset-name"
            placeholder="例：スカーフ型">

          <button
            type="button"
            class="party-pokemon-preset-save-button">
            現在の型を保存
          </button>
        </div>

        <div
          class="party-pokemon-preset-message"
          aria-live="polite">
        </div>
      </div>


      <div class="party-pokemon-detail-section party-pokemon-paste-section">
        <h3>テキストから一括反映</h3>

        <p class="party-pokemon-paste-help">
          1匹分の構築情報を貼り付け
        </p>

        <textarea
          class="party-pokemon-paste-input"
          rows="9"
          placeholder="Garchomp @ Choice Scarf
Ability: Rough Skin
Level: 50
EVs: 6 HP / 30 Atk / 1 Def / 1 SpD / 28 Spe
Adamant Nature
- Dragon Claw
- Rock Slide
- Stomping Tantrum
- Rock Tomb"></textarea>

        <div class="party-pokemon-paste-actions">
          <div
            class="party-pokemon-paste-message"
            aria-live="polite">
          </div>

          <button
            type="button"
            class="primary-button party-pokemon-paste-apply">
            テキストから反映
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);


  overlay
    .querySelector(
      ".party-pokemon-change-button"
    )
    .addEventListener(
      "click",
      () => {
        openDetailPokemonPicker(
          partyId,
          slotIndex,
          overlay
        );
      }
    );

  overlay
    .querySelector(
      ".party-pokemon-item-change-button"
    )
    .addEventListener(
      "click",
      () => {
        openDetailItemPicker(
          partyId,
          slotIndex,
          overlay
        );
      }
    );


  const readEditor = () => {
    const nextEvs = {};

    overlay
      .querySelectorAll(".pokemon-edit-stat")
      .forEach(input => {
        nextEvs[input.dataset.stat] =
          Number(input.value || 0);
      });

    const nextMoves =
      [...overlay.querySelectorAll(
        ".pokemon-edit-move"
      )]
        .map(input => input.value.trim())
        .filter(Boolean)
        .slice(0, 4);

    return {
      ability:
        overlay
          .querySelector(".pokemon-edit-ability")
          .value.trim() || null,

      nature:
        overlay
          .querySelector(".pokemon-edit-nature")
          .value.trim() || null,

      level:
        Number(
          overlay
            .querySelector(".pokemon-edit-level")
            .value || 50
        ),

      evs: nextEvs,
      moves: nextMoves
    };
  };


  const savePokemon = updates => {
    const parties = getParties();

    const partyIndex =
      parties.findIndex(
        party => party.id === partyId
      );

    if (partyIndex === -1) {
      return null;
    }

    if (
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= parties[partyIndex].pokemon.length
    ) {
      return null;
    }

    parties[partyIndex].pokemon[slotIndex] = {
      ...parties[partyIndex].pokemon[slotIndex],
      ...updates
    };

    saveParties(parties);

    return parties[partyIndex]
      .pokemon[slotIndex];
  };


  overlay
    .querySelector(".party-pokemon-direct-save")
    .addEventListener("click", () => {
      const message =
        overlay.querySelector(
          ".party-pokemon-save-message"
        );

      const saved =
        savePokemon(readEditor());

      if (!saved) {
        message.textContent =
          "保存先が見つかりません。";
        return;
      }

      overlay.remove();
      openPartyPokemonDetail(
        saved,
        partyId,
        slotIndex
      );
    });


  const presetSaveButton =
    overlay.querySelector(
      ".party-pokemon-preset-save-button"
    );

  presetSaveButton.addEventListener(
    "click",
    () => {
      const nameInput =
        overlay.querySelector(
          ".party-pokemon-preset-name"
        );

      const message =
        overlay.querySelector(
          ".party-pokemon-preset-message"
        );

      const name =
        nameInput.value.trim();

      if (!name) {
        message.textContent =
          "プリセット名を入力してください。";
        return;
      }

      const current =
        readEditor();

      const presets =
        getPresets();

      presets.push({
        id:
          "preset_" +
          Date.now() +
          "_" +
          Math.random()
            .toString(36)
            .slice(2, 8),

        name,

        pokemon_id: p.id,
        species_id: p.species_id,
        display_name: p.display_name,
        asset: p.asset,

        item_id: p.item_id || null,

        ability: current.ability,
        nature: current.nature,
        level: current.level,
        evs: current.evs,
        moves: current.moves,

        created_at:
          new Date().toISOString()
      });

      localStorage.setItem(
        presetKey,
        JSON.stringify(presets)
      );

      message.textContent =
        `「${name}」を保存しました。`;

      nameInput.value = "";

      setTimeout(() => {
        overlay.remove();
        openPartyPokemonDetail(
          p,
          partyId,
          slotIndex
        );
      }, 250);
    }
  );


  const presetApplyButton =
    overlay.querySelector(
      ".party-pokemon-preset-apply"
    );

  if (presetApplyButton) {
    presetApplyButton.addEventListener(
      "click",
      () => {
        const select =
          overlay.querySelector(
            ".party-pokemon-preset-select"
          );

        const message =
          overlay.querySelector(
            ".party-pokemon-preset-message"
          );

        if (!select.value) {
          message.textContent =
            "プリセットを選択してください。";
          return;
        }

        const preset =
          getPresets().find(
            value =>
              value.id === select.value
          );

        if (!preset) {
          message.textContent =
            "プリセットが見つかりません。";
          return;
        }

        const saved =
          savePokemon({
            item_id:
              preset.item_id || null,

            ability:
              preset.ability || null,

            nature:
              preset.nature || null,

            level:
              preset.level || 50,

            evs:
              preset.evs || {},

            moves:
              Array.isArray(preset.moves)
                ? preset.moves.slice(0, 4)
                : []
          });

        if (!saved) {
          message.textContent =
            "保存先が見つかりません。";
          return;
        }

        overlay.remove();
        openPartyPokemonDetail(
        saved,
        partyId,
        slotIndex
      );
      }
    );
  }


  const pasteInput =
    overlay.querySelector(
      ".party-pokemon-paste-input"
    );

  const pasteMessage =
    overlay.querySelector(
      ".party-pokemon-paste-message"
    );

  overlay
    .querySelector(
      ".party-pokemon-paste-apply"
    )
    .addEventListener("click", () => {
      const source =
        pasteInput.value.trim();

      if (!source) {
        pasteMessage.textContent =
          "構築情報を貼り付けてください。";
        return;
      }

      const parsed =
        parsePokepaste(source);

      if (!parsed.length) {
        pasteMessage.textContent =
          "構築情報を読み取れませんでした。";
        return;
      }

      const entry = parsed[0];

      const updates = {
        ability:
          entry.ability || null,

        nature:
          entry.nature || null,

        level:
          entry.level || 50,

        evs: {
          hp: entry.evs?.hp ?? 0,
          atk: entry.evs?.atk ?? 0,
          def: entry.evs?.def ?? 0,
          spa: entry.evs?.spa ?? 0,
          spd: entry.evs?.spd ?? 0,
          spe: entry.evs?.spe ?? 0
        },

        moves:
          Array.isArray(entry.moves)
            ? entry.moves.slice(0, 4)
            : [],

        pokepaste_raw:
          entry.raw || source
      };

      if (entry.item) {
        const normalizedItem =
          normalizeLookupText(entry.item);

        const itemEntry =
          Object.values(items)
            .find(item => {
              const candidates = [
                item.id,
                item.name,
                item.name_en,
                item.name_ja,
                item.display_name
              ]
                .filter(Boolean)
                .map(normalizeLookupText);

              return candidates.includes(
                normalizedItem
              );
            });

        if (itemEntry?.id) {
          updates.item_id =
            itemEntry.id;
        }
      }

      const saved =
        savePokemon(updates);

      if (!saved) {
        pasteMessage.textContent =
          "保存先が見つかりません。";
        return;
      }

      overlay.remove();
      openPartyPokemonDetail(
        saved,
        partyId,
        slotIndex
      );
    });


  overlay
    .querySelector(
      ".party-pokemon-detail-close"
    )
    .addEventListener(
      "click",
      () => overlay.remove()
    );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    }
  );
}


function showPartyDetail(partyId) {
  app.dataset.partyId = partyId;

  const party =
    getParties().find(p => p.id === partyId);

  if (!party) {
    showPartyList();
    return;
  }

  const matches =
    getMatches()
      .filter(m => m.party_id === partyId)
      .sort((a, b) =>
        new Date(b.played_at) -
        new Date(a.played_at)
      );

  const wins =
    matches.filter(m => m.result === "win").length;

  const losses =
    matches.filter(m => m.result === "loss").length;

  const winRate =
    matches.length
      ? Math.round((wins / matches.length) * 100)
      : 0;

  const hasDraft = !!loadDraft(partyId);

  app.innerHTML = `
    <div class="toolbar party-toolbar">
      <button
        id="back"
        class="secondary-button">
        ← 構築一覧
      </button>

      <div class="party-toolbar-actions">
        <button
        id="editParty"
        class="secondary-button">
        構築を編集
      </button>

      <button
          id="addMatch"
          class="primary-button">
          ${
            hasDraft
              ? "▶ 入力途中の対戦を再開"
              : "＋ 対戦を追加"
          }
        </button>

        <div class="party-menu-wrap">
        <button
          id="partyMenuButton"
          class="secondary-button party-menu-button"
          aria-label="構築メニュー"
          aria-expanded="false">
          ︙
        </button>

        <div
          id="partyMenu"
          class="party-menu"
          hidden>

          <button
            id="exportCsvMenu"
            class="party-menu-item">
            CSVを書き出す
          </button>

          <button
            id="exportJsonMenu"
            class="party-menu-item">
            JSONバックアップ
          </button>

          <div class="party-menu-divider"></div>

          <button
            id="deleteParty"
            class="party-menu-item party-menu-danger">
            構築を削除
          </button>

        </div>
      </div>
      </div>
    </div>

    <h1 class="page-title">
      ${escapeHtml(party.name)}
    </h1>

    <section class="section">
      <h2 class="section-title">使用ポケモン</h2>

      <div class="selected-area">
        ${party.pokemon.map((p, index) => `
          <div
            class="selected-slot filled party-pokemon-detail-button"
            data-pokemon-id="${escapeHtml(p.id)}"
            data-slot-index="${index}"
          >
            <div class="slot-inner">

              <img
                src="${imagePath(p)}"
                alt="${escapeHtml(p.display_name)}"
              >

              <div class="slot-name">
                ${escapeHtml(p.display_name)}
              </div>

              ${
                p.item_id && items[p.item_id]
                  ? `
                    <div class="party-detail-item">
                      ${
                        items[p.item_id].asset
                          ? `
                            <img
                              src="${itemImagePath(items[p.item_id])}"
                              alt=""
                            >
                          `
                          : ""
                      }

                      <span>
                        ${escapeHtml(
                          getPartyItemName(p.item_id)
                        )}
                      </span>
                    </div>
                  `
                  : `
                    <div class="party-detail-item party-detail-item-empty">
                      持ち物未設定
                    </div>
                  `
              }

            </div>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="section">

      <h2 class="section-title">
        対戦記録
      </h2>

      <div class="record-summary">
        <strong>${matches.length}</strong> 戦　
        <strong>${wins}</strong> 勝　
        <strong>${losses}</strong> 敗　
        勝率 <strong>${winRate}%</strong>
      </div>

      <div id="matchList" class="match-list">
        ${
          matches.length === 0
            ? `<div class="empty">
                 まだ対戦記録がありません。
               </div>`
            : matches
              .slice(0, 20)
              .map(m => renderMatchRow(m))
              .join("")
        }
      </div>
    </section>


  `;

  document
    .getElementById("back")
    .addEventListener("click", showPartyList);

  const partyMenuButton =
    document.getElementById("partyMenuButton");

  const partyMenu =
    document.getElementById("partyMenu");

  const exportJsonMenu =
    document.getElementById("exportJsonMenu");

  exportJsonMenu.addEventListener("click", () => {
    partyMenu.hidden = true;

    openSelectionTrackerBackupMenu();
  });


  partyMenuButton.addEventListener("click", e => {
    e.stopPropagation();

    const willOpen = partyMenu.hidden;

    partyMenu.hidden = !willOpen;

    partyMenuButton.setAttribute(
      "aria-expanded",
      String(willOpen)
    );
  });

  document.addEventListener(
    "click",
    function closePartyMenu(e) {
      if (
        !partyMenu.hidden &&
        !e.target.closest(".party-menu-wrap")
      ) {
        partyMenu.hidden = true;

        partyMenuButton.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    },
    { once: true }
  );

  document
    .getElementById("editParty")
    .addEventListener(
      "click",
      () => showPartyEditor(partyId)
    );

  document
    .querySelectorAll(
      ".party-pokemon-detail-button"
    )
    .forEach(card => {
      card.addEventListener(
        "click",
        () => {
          const slotIndex =
            Number(card.dataset.slotIndex);

          const target =
            party.pokemon[slotIndex];

          if (target) {
            openPartyPokemonDetail(
              target,
              partyId,
              slotIndex
            );
          }
        }
      );
    });

  document
    .getElementById("addMatch")
    .addEventListener("click", () => {
      showMatchEditor(partyId);
    });

  document
    .querySelectorAll(".match-row-clickable")
    .forEach(row => {
      row.addEventListener(
        "click",
        e => {
          if (
            e.target.closest("button") ||
            e.target.closest("a")
          ) {
            return;
          }

          showMatchEditor(
            partyId,
            row.dataset.matchId
          );
        }
      );
    });

  document
    .getElementById("deleteParty")
    .addEventListener("click", () => {
      const ok =
        confirm(
          `「${party.name}」を削除しますか？`
        );

      if (!ok) return;

      saveParties(
        getParties()
          .filter(p => p.id !== party.id)
      );

      saveMatches(
        getMatches()
          .filter(m => m.party_id !== party.id)
      );

      clearDraft(party.id);

      showPartyList();
    });
}

function renderMatchRow(match) {
  const party =
    getParties().find(
      p => p.id === match.party_id
    );

  const myTeam =
    party?.pokemon || [];

  const opponentTeam =
    match.opponent_team || [];

  const revealedInfo =
    match.revealed_info || {};

  const getRevealedPokemon = p => {
    if (!p) return p;

    const formId =
      revealedInfo[p.id]?.form_id;

    if (!formId) return p;

    return (
      pokemon.find(x => x.id === formId) ||
      p
    );
  };

  const opponentTeamDisplay =
    opponentTeam.map(getRevealedPokemon);

  const mySelectedIds = [
    ...(match.my_lead || []),
    ...(match.my_back || [])
  ];

  const opponentSelectedIds = [
    ...(match.opponent_lead || []),
    ...(match.opponent_back || [])
  ];

  const mySelected =
    mySelectedIds
      .map(id =>
        myTeam.find(p => p.id === id)
      )
      .filter(Boolean);

  const opponentSelected =
    opponentSelectedIds
      .map(id =>
        opponentTeam.find(p => p.id === id)
      )
      .filter(Boolean)
      .map(getRevealedPokemon);

  const renderIcons = (
    team,
    showOpponentItems = false
  ) =>
    team.map(p => {
      const original =
        showOpponentItems
          ? opponentTeam.find(
              x =>
                x.id === p.id ||
                revealedInfo[x.id]?.form_id === p.id
            )
          : null;

      const itemId =
        original
          ? revealedInfo[original.id]?.item_id
          : null;

      const item =
        itemId
          ? items[itemId]
          : null;

      return `
        <div class="history-pokemon-icon">
          <img
            class="history-pokemon-image"
            src="${imagePath(p)}"
            alt="${escapeHtml(p.display_name)}"
            title="${escapeHtml(p.display_name)}"
          >

          ${
            item?.asset
              ? `
                <img
                  class="history-item-icon"
                  src="${itemImagePath(item)}"
                  alt="${escapeHtml(
                    item.name?.ja ||
                    item.name?.en ||
                    item.display_name ||
                    itemId
                  )}"
                  title="${escapeHtml(
                    item.name?.ja ||
                    item.name?.en ||
                    item.display_name ||
                    itemId
                  )}"
                >
              `
              : ""
          }
        </div>
      `;
    }).join("");

  const date =
    new Date(match.played_at)
      .toLocaleString("ja-JP");

  return `
    <div
      class="match-row match-row-detail match-row-clickable"
      data-match-id="${match.id}"
    >

      <div class="match-result ${match.result}">
        ${match.result === "win" ? "WIN" : "LOSE"}
      </div>

      <div class="match-main">

        <div class="match-date">
          ${date}
        </div>

        <div class="match-content-row">

          <div class="match-battle-info">

            <div class="match-history-grid">

              <div class="history-side">

                <div class="history-label">
                  自分 6匹
                </div>

                <div class="history-icons six">
                  ${renderIcons(myTeam)}
                </div>

                <div class="history-label sub">
                  選出
                </div>

                <div class="history-icons four">
                  ${renderIcons(mySelected)}
                </div>

              </div>


              <div class="history-vs">
                VS
              </div>


              <div class="history-side">

                <div class="history-label">
                  相手 6匹
                </div>

                <div class="history-icons six">
                  ${renderIcons(opponentTeamDisplay, true)}
                </div>

                <div class="history-label sub">
                  選出
                </div>

                <div class="history-icons four">
                  ${renderIcons(opponentSelected, true)}
                </div>

              </div>

            </div>

          </div>


          <div class="match-memo-area">

            <div class="history-label">
              メモ
            </div>

            <div class="match-memo-display">
              ${
                match.memo
                  ? escapeHtml(match.memo)
                      .replaceAll("\n", "<br>")
                  : '<span class="match-memo-empty">メモなし</span>'
              }
            </div>

          </div>

        </div>

      </div>

    </div>
  `;
}

/* =========================
   Match editor
========================= */

function createEmptyDraft(partyId) {
  return {
    party_id: partyId,

    opponent_team: [],

    my_selection: [],
    opponent_selection: [],

    result: null,

    updated_at:
      new Date().toISOString()
  };
}

function showMatchEditor(partyId, matchId = null) {
  const party =
    getParties().find(p => p.id === partyId);

  if (!party) {
    showPartyList();
    return;
  }

  let draft;

  if (matchId) {
    const match =
      getMatches().find(
        m => String(m.id) === String(matchId)
      );

    if (!match) {
      showPartyDetail(partyId);
      return;
    }

    draft = {
      party_id: partyId,

      opponent_team:
        match.opponent_team || [],

      revealed_info:
        match.revealed_info || {},

      my_selection: [
        ...(match.my_lead || []),
        ...(match.my_back || [])
      ],

      opponent_selection: [
        ...(match.opponent_lead || []),
        ...(match.opponent_back || [])
      ],

      result:
        match.result || null,

      memo:
        match.memo || "",

      editing_match_id:
        match.id,

      updated_at:
        new Date().toISOString()
    };

  } else {
    draft =
      loadDraft(partyId) ||
      createEmptyDraft(partyId);

    if (draft.memo == null) {
      draft.memo = "";
    }

    if (
      !draft.revealed_info ||
      typeof draft.revealed_info !== "object"
    ) {
      draft.revealed_info = {};
    }

    if (draft.editing_match_id == null) {
      draft.editing_match_id = null;
    }
  }

  function persist() {
    draft.updated_at =
      new Date().toISOString();

    saveDraft(partyId, draft);
  }

  function openRevealedInfoEditor(p) {
    const current =
      draft.revealed_info?.[p.id] || {};

    let selectedFormId =
      current.form_id || "";

    let selectedItemId =
      current.item_id || "";

    const forms =
      pokemon.filter(x =>
        x.species_id === p.species_id
      );

    const overlay =
      document.createElement("div");

    overlay.className =
      "revealed-editor-overlay";

    overlay.innerHTML = `
      <div class="revealed-editor">

        <div class="revealed-editor-head">
          <div>
            <strong>
              ${escapeHtml(p.display_name)}
            </strong>
          </div>

          <button
            type="button"
            class="revealed-editor-close">
            ×
          </button>
        </div>

        <div class="revealed-editor-section">
          <div class="revealed-editor-label">
            判明した姿
          </div>

          <div class="revealed-form-list">
            <button
              type="button"
              class="revealed-form-option ${
                !selectedFormId ? "selected" : ""
              }"
              data-form-id="">
              未確認
            </button>

            ${forms.map(form => `
              <button
                type="button"
                class="revealed-form-option ${
                  selectedFormId === form.id
                    ? "selected"
                    : ""
                }"
                data-form-id="${escapeHtml(form.id)}">
                ${escapeHtml(form.display_name)}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="revealed-editor-section">
          <div class="revealed-editor-label">
            判明した持ち物
          </div>

          <input
            type="search"
            class="revealed-item-search"
            placeholder="持ち物を検索"
            autocomplete="off"
          >

          <div class="revealed-current-item"></div>

          <div class="revealed-item-results"></div>
        </div>

        <div class="revealed-editor-actions">
          <button
            type="button"
            class="secondary-button revealed-clear">
            判明情報を解除
          </button>

          <button
            type="button"
            class="primary-button revealed-save">
            保存
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
    };

    overlay
      .querySelector(".revealed-editor-close")
      .addEventListener("click", close);

    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        close();
      }
    });

    const formButtons =
      overlay.querySelectorAll(
        ".revealed-form-option"
      );

    formButtons.forEach(button => {
      button.addEventListener("click", () => {
        selectedFormId =
          button.dataset.formId || "";

        formButtons.forEach(x =>
          x.classList.remove("selected")
        );

        button.classList.add("selected");
      });
    });

    const itemSearch =
      overlay.querySelector(
        ".revealed-item-search"
      );

    const itemResults =
      overlay.querySelector(
        ".revealed-item-results"
      );

    const currentItem =
      overlay.querySelector(
        ".revealed-current-item"
      );

    function getItemName(id) {
      const item = items[id];

      if (!item) return id || "";

      return (
        item.name?.ja ||
        item.name?.en ||
        item.display_name ||
        id
      );
    }

    function renderCurrentItem() {
      if (
        !selectedItemId ||
        !items[selectedItemId]
      ) {
        currentItem.innerHTML = `
          <div class="revealed-item-empty">
            選択中：未確認
          </div>
        `;

        return;
      }

      const item =
        items[selectedItemId];

      currentItem.innerHTML = `
        <div class="revealed-selected-item">

          ${
            item.asset
              ? `
                <img
                  src="${itemImagePath(item)}"
                  alt="${escapeHtml(
                    getItemName(selectedItemId)
                  )}"
                >
              `
              : ""
          }

          <div class="revealed-selected-item-name">
            <span>選択中</span>
            <strong>
              ${escapeHtml(
                getItemName(selectedItemId)
              )}
            </strong>
          </div>

          <button
            type="button"
            class="revealed-item-clear"
            aria-label="持ち物を未確認に戻す">
            ×
          </button>

        </div>
      `;

      currentItem
        .querySelector(".revealed-item-clear")
        .addEventListener("click", () => {
          selectedItemId = "";

          renderCurrentItem();

          itemSearch.focus();
        });
    }

    function renderItemResults(query) {
      itemResults.innerHTML = "";

      const q =
        query.trim().toLowerCase();

      if (!q) return;

      const matches =
        Object.entries(items)
          .filter(([id, item]) => {
            const ja =
              String(
                item.name?.ja || ""
              ).toLowerCase();

            const en =
              String(
                item.name?.en || ""
              ).toLowerCase();

            return (
              id.toLowerCase().includes(q) ||
              ja.includes(q) ||
              en.includes(q)
            );
          })
          .slice(0, 20);

      if (!matches.length) {
        itemResults.innerHTML = `
          <div class="revealed-item-no-results">
            候補なし
          </div>
        `;

        return;
      }

      matches.forEach(([id, item]) => {
        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "revealed-item-option";

        if (id === selectedItemId) {
          button.classList.add("selected");
        }

        button.innerHTML = `
          ${
            item.asset
              ? `
                <img
                  src="${itemImagePath(item)}"
                  alt=""
                >
              `
              : `
                <span
                  class="revealed-item-placeholder">
                </span>
              `
          }

          <span>
            ${escapeHtml(
              getItemName(id)
            )}
          </span>

          ${
            id === selectedItemId
              ? `<strong class="revealed-item-check">✓</strong>`
              : ""
          }
        `;

        button.addEventListener(
          "click",
          () => {
            selectedItemId = id;

            /*
             * 候補を押した時点ではdraftを書き換えない。
             * 保存ボタンを押した時に正式保存する。
             * ただしUI上は選択済みを明確にする。
             */

            renderCurrentItem();

            itemSearch.value = "";

            itemResults.innerHTML = "";

            itemSearch.focus();
          }
        );

        itemResults.appendChild(button);
      });
    }

    itemSearch.addEventListener(
      "input",
      () => {
        renderItemResults(
          itemSearch.value
        );
      }
    );

    /*
     * エディタを開いた時点で、
     * 保存済みitem_idを選択中として表示する。
     */
    renderCurrentItem();

    overlay
      .querySelector(".revealed-clear")
      .addEventListener("click", () => {
        delete draft.revealed_info[p.id];

        persist();
        close();
        render();
      });

    overlay
      .querySelector(".revealed-save")
      .addEventListener("click", () => {
        if (!draft.revealed_info) {
          draft.revealed_info = {};
        }

        if (
          !selectedFormId &&
          !selectedItemId
        ) {
          delete draft.revealed_info[p.id];
        } else {
          draft.revealed_info[p.id] = {
            form_id:
              selectedFormId || null,

            item_id:
              selectedItemId || null
          };
        }

        persist();
        close();
        render();
      });
  }

  function render() {
app.innerHTML = `
      <div class="match-page">

        <div class="match-topbar">
          <button
            id="cancelMatch"
            class="secondary-button compact-action">
            ← 戻る
          </button>

          <div class="match-title">
            対戦記録
          </div>

          <button
            id="discardMatch"
            class="danger-button compact-action">
            破棄
          </button>
        </div>


        <div class="match-editor-columns">

          <main class="match-editor-left">

        <section class="match-section">

          <div class="match-section-head">
            <h2>① 相手6匹</h2>

            <span class="match-count">
              ${draft.opponent_team.length}/6
            </span>
          </div>

          <div
            id="opponentTeam"
            class="selected-area match-six-grid">
          </div>

          <div class="toolbar match-search">

            <input
              id="opponentSearch"
              type="search"
              placeholder="相手のポケモンを検索"
              autocomplete="off"
            >

          </div>

          <div
            id="opponentResults"
            class="grid compact-grid">
          </div>

        </section>


        <section class="match-section">

          <div class="match-section-head">
            <h2>② 自分の選出</h2>

            <span class="match-hint">
              初手2 → 後発2
            </span>
          </div>

          <div
            id="myTeamSelection"
            class="battle-team-grid compact-battle-grid">
          </div>

        </section>


        <section class="match-section">

          <div class="match-section-head">
            <h2>③ 相手の実選出</h2>

            <span class="match-hint">
              後発は見えた分だけ
            </span>
          </div>

          <div
            id="opponentActualSelection"
            class="battle-team-grid compact-battle-grid">
          </div>

        </section>


        <section class="match-section result-section">

          <div class="match-section-head">
            <h2>④ 結果</h2>
          </div>

          <div class="result-buttons compact-result-buttons">

            <button
              id="resultWin"
              class="result-button win
              ${draft.result === "win" ? "active" : ""}">
              WIN
            </button>

            <button
              id="resultLoss"
              class="result-button loss
              ${draft.result === "loss" ? "active" : ""}">
              LOSE
            </button>

          </div>

        </section>


        <div class="match-save-bar">

          <div class="autosave-label">
            自動保存中
          </div>

          <button
            id="saveMatch"
            class="primary-button save-match-button"
            ${canSaveMatch(draft) ? "" : "disabled"}>
            この内容で保存
          </button>

        </div>

          </main>

          <aside class="match-editor-memo">

            <div class="match-section-head">
              <h2>⑤ メモ</h2>
            </div>

            <textarea
              id="matchDraftMemo"
              class="match-draft-memo"
              placeholder="対戦中に気づいたこと・次に試したいこと"
            >${escapeHtml(draft.memo || "")}</textarea>

          </aside>

        </div>

      </div>
    `;

    // ⑤の外枠を①の上端〜④の下端に完全一致させる
    requestAnimationFrame(() => {
      const left = document.querySelector(".match-editor-left");
      const memo = document.querySelector(".match-editor-memo");

      if (!left || !memo) return;

      const sections =
        left.querySelectorAll(":scope > .match-section");

      if (sections.length < 4) return;

      const firstRect =
        sections[0].getBoundingClientRect();

      const fourthRect =
        sections[3].getBoundingClientRect();

      const memoRect =
        memo.getBoundingClientRect();

      // ⑤の上端 = ①の外枠上端
      const topOffset =
        firstRect.top - memoRect.top;

      memo.style.transform =
        `translateY(${Math.round(topOffset)}px)`;

      // ⑤の下端 = ④の外枠下端
      memo.style.height =
        Math.round(fourthRect.bottom - firstRect.top) + "px";
    });

    renderOpponentTeamSlots();
    renderOpponentSearch("");

    // 相手6匹が揃ったら検索UIを畳む
    const opponentSearch =
      document.getElementById("opponentSearch");

    const opponentResults =
      document.getElementById("opponentResults");

    const opponentSearchWrap =
      opponentSearch
        ? opponentSearch.closest(".match-search")
        : null;

    if (draft.opponent_team.length >= 6) {
      if (opponentSearchWrap) {
        opponentSearchWrap.style.display = "none";
      }

      if (opponentResults) {
        opponentResults.style.display = "none";
      }
    }

    renderBattleTeam(
      "myTeamSelection",
      party.pokemon,
      draft.my_selection,
      "my"
    );

    renderBattleTeam(
      "opponentActualSelection",
      draft.opponent_team,
      draft.opponent_selection,
      "opponent"
    );

    document
      .getElementById("cancelMatch")
      .addEventListener("click", () => {
        persist();
        showPartyDetail(partyId);
      });

    document
      .getElementById("discardMatch")
      .addEventListener("click", () => {
        const ok =
          confirm(
            "入力中の対戦記録を破棄しますか？"
          );

        if (!ok) return;

        clearDraft(partyId);
        showPartyDetail(partyId);
      });

    document
      .getElementById("opponentSearch")
      .addEventListener("input", e => {
        renderOpponentSearch(e.target.value);
      });

    document
      .getElementById("resultWin")
      .addEventListener("click", () => {
        draft.result = "win";
        persist();
        render();
      });

    document
      .getElementById("resultLoss")
      .addEventListener("click", () => {
        draft.result = "loss";
        persist();
        render();
      });

    document
      .getElementById("matchDraftMemo")
      .addEventListener("input", e => {
        draft.memo = e.target.value;
        persist();
      });

    document
      .getElementById("saveMatch")
      .addEventListener("click", () => {
        saveMatchFromDraft(
          partyId,
          draft
        );
      });
  }

  function renderOpponentTeamSlots() {
    const box =
      document.getElementById("opponentTeam");

    box.innerHTML = "";

    for (let i = 0; i < 6; i++) {
      const p =
        draft.opponent_team[i];

      const slot =
        document.createElement("div");

      slot.className =
        "selected-slot" +
        (p ? " filled" : "");

      if (!p) {
        slot.textContent = "未選択";
      } else {
        const revealed =
          draft.revealed_info?.[p.id] || {};

        const revealedForm =
          revealed.form_id
            ? pokemon.find(
                x => x.id === revealed.form_id
              )
            : null;

        const revealedItem =
          revealed.item_id
            ? items[revealed.item_id]
            : null;

        slot.innerHTML = `
          <button
            type="button"
            class="slot-remove"
            aria-label="${escapeHtml(p.display_name)}を削除">
            ×
          </button>

          <div class="slot-inner">

            <img
              src="${
                revealedForm
                  ? imagePath(revealedForm)
                  : imagePath(p)
              }"
              alt="${escapeHtml(
                revealedForm?.display_name ||
                p.display_name
              )}"
            >

            <div class="slot-name">
              ${escapeHtml(p.display_name)}
            </div>

            ${
              revealedForm
                ? `
                  <div class="slot-revealed">
                    ${escapeHtml(
                      revealedForm.display_name
                    )}
                  </div>
                `
                : ""
            }

            ${
              revealedItem?.asset
                ? `
                  <img
                    class="slot-item-icon"
                    src="${itemImagePath(revealedItem)}"
                    alt="${escapeHtml(
                      revealedItem.name?.ja ||
                      revealedItem.name?.en ||
                      revealedItem.display_name ||
                      revealed.item_id
                    )}"
                  >
                `
                : ""
            }

          </div>
        `;

        slot
          .querySelector(".slot-remove")
          .addEventListener("click", e => {
            e.stopPropagation();

            draft.opponent_team =
              draft.opponent_team
                .filter(x => x.id !== p.id);

            draft.opponent_selection =
              draft.opponent_selection
                .filter(id => id !== p.id);

            if (draft.revealed_info) {
              delete draft.revealed_info[p.id];
            }

            persist();
            render();
          });

        slot.addEventListener("click", () => {
          openRevealedInfoEditor(p);
        });
      }

      box.appendChild(slot);
    }
  }

  function renderOpponentSearch(query) {
    const results =
      document.getElementById(
        "opponentResults"
      );

    if (!results) return;

    results.innerHTML = "";

    const q = query.trim();

    /*
     * 相手6匹入力：
     *
     * 空欄
     *   → 保存済み対戦から頻出ポケモンを表示
     *
     * 入力あり
     *   → 通常の名前検索
     */

    let groups = [];

    if (!q) {
      const counts = new Map();

      /*
       * 現在選択している相手ポケモン。
       * フォームではなくspecies_id単位で条件判定する。
       */
      const selectedSpecies =
        new Set(
          draft.opponent_team
            .map(p => p?.species_id)
            .filter(Boolean)
        );

      /*
       * 条件に一致した過去対戦数。
       *
       * 0匹選択:
       *   全対戦が対象
       *
       * 1匹以上:
       *   選択済みポケモンを全て含む
       *   opponent_teamだけ対象
       */
      let matchedBattleCount = 0;

      const collectMatch = match => {
        if (
          !match ||
          !Array.isArray(match.opponent_team)
        ) {
          return;
        }

        const teamSpecies =
          new Set(
            match.opponent_team
              .map(p => p?.species_id)
              .filter(Boolean)
          );

        /*
         * 選択済み全員が過去構築にいるか。
         */
        const matchesCondition =
          [...selectedSpecies]
            .every(speciesId =>
              teamSpecies.has(speciesId)
            );

        if (!matchesCondition) {
          return;
        }

        matchedBattleCount += 1;

        /*
         * 同じ試合内で同一speciesを
         * 二重カウントしない。
         */
        teamSpecies.forEach(speciesId => {
          /*
           * 既に選択しているポケモンは
           * 候補には出さない。
           */
          if (
            selectedSpecies.has(speciesId)
          ) {
            return;
          }

          counts.set(
            speciesId,
            (counts.get(speciesId) || 0) + 1
          );
        });
      };

      /*
       * 既存仕様と同じくlocalStorageから
       * 保存済み対戦を収集する。
       */
      Object.keys(localStorage).forEach(key => {
        let value;

        try {
          value =
            JSON.parse(
              localStorage.getItem(key)
            );
        } catch {
          return;
        }

        if (Array.isArray(value)) {
          value.forEach(collectMatch);

        } else if (
          value &&
          typeof value === "object"
        ) {
          if (Array.isArray(value.matches)) {
            value.matches.forEach(
              collectMatch
            );
          }

          collectMatch(value);
        }
      });

      const allGroups =
        filterSpeciesGroups(
          pokemon,
          ""
        );

      groups =
        allGroups
          .filter(group =>
            counts.has(group.species_id)
          )
          .sort((a, b) => {
            const countDiff =
              (counts.get(b.species_id) || 0) -
              (counts.get(a.species_id) || 0);

            if (countDiff !== 0) {
              return countDiff;
            }

            return String(a.display_name || "")
              .localeCompare(
                String(b.display_name || ""),
                "ja"
              );
          })
          .slice(0, 10);

      if (groups.length) {
        const label =
          document.createElement("div");

        label.className =
          "opponent-suggestion-label";

        if (selectedSpecies.size === 0) {
          label.textContent =
            "よく出る";

        } else {
          label.textContent =
            `一緒に採用されていたポケモン ${
              matchedBattleCount
            }戦`;
        }

        results.appendChild(label);
      } else if (
        selectedSpecies.size > 0
      ) {
        const label =
          document.createElement("div");

        label.className =
          "opponent-suggestion-label";

        label.textContent =
          "この組み合わせの過去データなし";

        results.appendChild(label);
      }

    } else {
      groups =
        filterSpeciesGroups(
          pokemon,
          q
        ).slice(0, 10);
    }

    groups
      .forEach(group => {

        const isFrequentSuggestion =
          !q;

        const card =
          createSpeciesCard(
            group,
            {
              selectedIds:
                draft.opponent_team
                  .map(p => p.id),

              onSelect: p => {

                const active =
                  draft.opponent_team
                    .some(x =>
                      x.id === p.id
                    );

                if (active) {
                  draft.opponent_team =
                    draft.opponent_team
                      .filter(x =>
                        x.id !== p.id
                      );

                  draft.opponent_selection =
                    draft.opponent_selection
                      .filter(id =>
                        id !== p.id
                      );

                } else {
                  if (
                    draft.opponent_team
                      .length >= 6
                  ) {
                    return;
                  }

                  draft.opponent_team.push({
                    id: p.id,
                    species_id:
                      p.species_id,
                    display_name:
                      p.display_name,
                    asset:
                      p.asset
                  });
                }

                persist();
                render();
              }
            }
          );

        if (card) {
          if (isFrequentSuggestion) {
          card.classList.add(
            "opponent-frequent-card"
          );
        }

        results.appendChild(card);
        }
      });
  }

  function renderBattleTeam(
    containerId,
    team,
    selection,
    side
  ) {
    const box =
      document.getElementById(containerId);

    if (!box) return;

    box.innerHTML = "";

    team.forEach(p => {
      const index =
        selection.indexOf(p.id);

      let role = "";
      let roleClass = "";

      if (index === 0 || index === 1) {
        role = `初手${index + 1}`;
        roleClass = "lead";
      }

      if (index === 2 || index === 3) {
        role = `後発${index - 1}`;
        roleClass = "back";
      }

      const card =
        document.createElement("div");

      card.className =
        `battle-card ${roleClass}`;

      const displayPokemon =
        side === "opponent"
          ? (
              pokemon.find(
                x =>
                  x.id ===
                  draft.revealed_info?.[p.id]?.form_id
              ) || p
            )
          : p;

      const revealedItemId =
        side === "opponent"
          ? draft.revealed_info?.[p.id]?.item_id
          : null;

      const revealedItem =
        revealedItemId
          ? items[revealedItemId]
          : null;

      card.innerHTML = `
        ${
          role
            ? `<div class="role-label">
                 ${role}
               </div>`
            : ""
        }

        <img
          src="${imagePath(displayPokemon)}"
          alt="${escapeHtml(displayPokemon.display_name)}"
        >

        <div class="card-name">
          ${escapeHtml(displayPokemon.display_name)}
        </div>

        ${
          revealedItem?.asset
            ? `
              <img
                class="battle-item-icon"
                src="${itemImagePath(revealedItem)}"
                alt="${escapeHtml(
                  revealedItem.name?.ja ||
                  revealedItem.name?.en ||
                  revealedItem.display_name ||
                  revealedItemId
                )}"
                title="${escapeHtml(
                  revealedItem.name?.ja ||
                  revealedItem.name?.en ||
                  revealedItem.display_name ||
                  revealedItemId
                )}"
              >
            `
            : ""
        }
      `;

      card.addEventListener("click", () => {
        let target =
          side === "my"
            ? draft.my_selection
            : draft.opponent_selection;

        const existing =
          target.indexOf(p.id);

        if (existing >= 0) {
          target.splice(existing, 1);
        } else {
          if (target.length >= 4) return;
          target.push(p.id);
        }

        persist();
        render();
      });

      box.appendChild(card);
    });
  }

  render();
}

function canSaveMatch(draft) {
  return (
    draft.opponent_team.length === 6 &&
    draft.my_selection.length === 4 &&
    draft.opponent_selection.length >= 2 &&
    draft.opponent_selection.length <= 4 &&
    !!draft.result
  );
}

function saveMatchFromDraft(
  partyId,
  draft
) {
  if (!canSaveMatch(draft)) return;

  const matches =
    getMatches();

  const matchData = {
    party_id: partyId,

    opponent_team:
      draft.opponent_team,

    revealed_info:
      draft.revealed_info || {},

    my_lead:
      draft.my_selection.slice(0, 2),

    my_back:
      draft.my_selection.slice(2, 4),

    opponent_lead:
      draft.opponent_selection.slice(0, 2),

    opponent_back:
      draft.opponent_selection.slice(2, 4),

    result:
      draft.result,

    memo:
      draft.memo || ""
  };

  if (draft.editing_match_id) {

    const index =
      matches.findIndex(
        m =>
          String(m.id) ===
          String(draft.editing_match_id)
      );

    if (index === -1) {
      return;
    }

    matches[index] = {
      ...matches[index],
      ...matchData,
      id: matches[index].id,
      played_at:
        matches[index].played_at
    };

  } else {

    matches.push({
      id: `match_${Date.now()}`,

      played_at:
        new Date().toISOString(),

      ...matchData
    });

  }

  saveMatches(matches);

  clearDraft(partyId);

  showPartyDetail(partyId);
}

/* =========================
   Utils
========================= */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadData();


/* =========================================================
 * Selection Tracker Backup / Restore
 * ========================================================= */

function exportSelectionTrackerBackup() {
  const storage = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key) continue;

    storage[key] =
      localStorage.getItem(key);
  }

  const backup = {
    format: "gawhota-selection-tracker-backup",
    version: 1,
    exported_at: new Date().toISOString(),
    storage
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  a.href = url;
  a.download =
    `gawhota_selection_backup_${date}.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}


function importSelectionTrackerBackup(file) {
  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const backup =
        JSON.parse(reader.result);

      if (
        backup?.format !==
          "gawhota-selection-tracker-backup" ||
        !backup.storage ||
        typeof backup.storage !== "object"
      ) {
        throw new Error(
          "Selection Trackerのバックアップではありません"
        );
      }

      const ok =
        confirm(
          "現在のSelection Trackerデータをバックアップ内容で復元します。\n\n続行しますか？"
        );

      if (!ok) return;

      /*
       * 別オリジンへの移行を目的としているため、
       * 現在のSelection Tracker保存領域を置き換える。
       */
      localStorage.clear();

      Object.entries(
        backup.storage
      ).forEach(([key, value]) => {
        if (typeof value === "string") {
          localStorage.setItem(
            key,
            value
          );
        }
      });

      alert(
        "バックアップを復元しました。\n画面を再読み込みします。"
      );

      location.reload();

    } catch (error) {
      console.error(error);

      alert(
        "バックアップを読み込めませんでした。\n" +
        error.message
      );
    }
  };

  reader.readAsText(file);
}


function openSelectionTrackerBackupMenu() {
  const overlay =
    document.createElement("div");

  overlay.className =
    "revealed-editor-overlay";

  overlay.innerHTML = `
    <div
      class="revealed-editor-panel"
      style="
        width:min(440px,calc(100vw - 40px));
        padding:20px;
      "
    >
      <h2 style="margin-top:0;">
        バックアップ
      </h2>

      <p>
        構築・対戦記録・プリセットなど、
        この端末に保存されているSelection Trackerの
        データを移行できます。
      </p>

      <button
        type="button"
        id="selection-backup-export"
        style="
          width:100%;
          min-height:48px;
          margin-top:10px;
        "
      >
        バックアップを書き出す
      </button>

      <button
        type="button"
        id="selection-backup-import"
        style="
          width:100%;
          min-height:48px;
          margin-top:10px;
        "
      >
        バックアップから復元
      </button>

      <input
        type="file"
        id="selection-backup-file"
        accept=".json,application/json"
        hidden
      >

      <button
        type="button"
        id="selection-backup-close"
        style="
          width:100%;
          min-height:44px;
          margin-top:20px;
        "
      >
        閉じる
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const fileInput =
    overlay.querySelector(
      "#selection-backup-file"
    );

  overlay
    .querySelector(
      "#selection-backup-export"
    )
    .addEventListener(
      "click",
      exportSelectionTrackerBackup
    );

  overlay
    .querySelector(
      "#selection-backup-import"
    )
    .addEventListener(
      "click",
      () => fileInput.click()
    );

  fileInput.addEventListener(
    "change",
    () => {
      importSelectionTrackerBackup(
        fileInput.files?.[0]
      );
    }
  );

  overlay
    .querySelector(
      "#selection-backup-close"
    )
    .addEventListener(
      "click",
      () => overlay.remove()
    );
}

