
function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60)
    )
    .replace(/[ー‐-‒–—―]/g, "ー")
    .replace(/\s+/g, "");
}

function groupPokemonBySpecies(list) {
  const map = new Map();

  list.forEach(p => {
    const key = p.species_id || p.id;

    if (!map.has(key)) {
      map.set(key, {
        species_id: key,
        forms: []
      });
    }

    map.get(key).forms.push(p);
  });

  return Array.from(map.values());
}

function getSpeciesDisplayName(group) {
  if (!group || !group.forms.length) return "";

  const normal =
    group.forms.find(p =>
      !p.form_ja ||
      p.form_ja === "通常" ||
      p.id === p.species_id
    ) ||
    group.forms[0];

  if (normal.name_ja) {
    return normal.name_ja;
  }

  return (normal.display_name || "")
    .replace(/\s*\(.+?\)\s*$/, "");
}

function getRepresentativePokemon(group) {
  if (!group || !group.forms.length) return null;

  return (
    group.forms.find(p =>
      !p.form_ja ||
      p.form_ja === "通常" ||
      p.id === p.species_id
    ) ||
    group.forms[0]
  );
}

function filterSpeciesGroups(list, query) {
  const regulationList =
    typeof getRegulationPokemon === "function"
      ? getRegulationPokemon(list)
      : list;

  const q = normalizeSearchText(query);

  const groups =
    groupPokemonBySpecies(regulationList);

  if (!q) return groups;

  return groups.filter(group => {
    const speciesName =
      normalizeSearchText(
        getSpeciesDisplayName(group)
      );

    const formMatch =
      group.forms.some(p => {
        const displayName =
          normalizeSearchText(
            p.display_name || ""
          );

        const japaneseName =
          normalizeSearchText(
            p.name_ja || ""
          );

        const formName =
          normalizeSearchText(
            p.form_ja || ""
          );

        const id =
          normalizeSearchText(
            p.id || ""
          );

        return (
          displayName.includes(q) ||
          japaneseName.includes(q) ||
          formName.includes(q) ||
          id.includes(q)
        );
      });

    return (
      speciesName.includes(q) ||
      formMatch
    );
  });
}

function choosePokemonFromSpecies(group, callback) {
  if (!group || group.forms.length === 0) return;

  if (group.forms.length === 1) {
    callback(group.forms[0]);
    return;
  }

  showFormPicker(group, callback);
}

function showFormPicker(group, callback) {
  closeFormPicker();

  const overlay =
    document.createElement("div");

  overlay.id = "formPickerOverlay";
  overlay.className = "form-picker-overlay";

  const panel =
    document.createElement("div");

  panel.className = "form-picker-panel";

  const title =
    getSpeciesDisplayName(group);

  panel.innerHTML = `
    <div class="form-picker-header">
      <div>
        <div class="form-picker-subtitle">
          フォームを選択
        </div>

        <div class="form-picker-title">
          ${escapeHtml(title)}
        </div>
      </div>

      <button
        id="closeFormPicker"
        class="form-picker-close"
        type="button">
        ×
      </button>
    </div>

    <div
      id="formPickerGrid"
      class="form-picker-grid">
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const grid =
    panel.querySelector("#formPickerGrid");

  group.forms.forEach(p => {
    const card =
      document.createElement("button");

    card.type = "button";
    card.className = "form-picker-card";

    const label =
      p.form_ja || "通常";

    card.innerHTML = `
      <img
        src="${imagePath(p)}"
        alt="${escapeHtml(p.display_name)}"
      >

      <div class="form-picker-form-name">
        ${escapeHtml(label)}
      </div>

      <div class="form-picker-full-name">
        ${escapeHtml(p.display_name)}
      </div>
    `;

    card.addEventListener("click", () => {
      closeFormPicker();
      callback(p);
    });

    grid.appendChild(card);
  });

  panel
    .querySelector("#closeFormPicker")
    .addEventListener(
      "click",
      closeFormPicker
    );

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        closeFormPicker();
      }
    }
  );
}

function closeFormPicker() {
  const old =
    document.getElementById("formPickerOverlay");

  if (old) {
    old.remove();
  }
}

function createSpeciesCard(group, options = {}) {
  const {
    selectedIds = [],
    onSelect = () => {}
  } = options;

  const representative =
    getRepresentativePokemon(group);

  if (!representative) return null;

  const card =
    document.createElement("div");

  const anySelected =
    group.forms.some(p =>
      selectedIds.includes(p.id)
    );

  card.className =
    "card species-card" +
    (anySelected ? " selected" : "");

  card.innerHTML = `
    <img
      src="${imagePath(representative)}"
      alt="${escapeHtml(
        getSpeciesDisplayName(group)
      )}"
    >

    <div class="card-name">
      ${escapeHtml(
        getSpeciesDisplayName(group)
      )}
    </div>

    ${
      group.forms.length > 1
        ? `
          <div class="form-count">
            ${group.forms.length}フォーム
          </div>
        `
        : ""
    }
  `;

  card.addEventListener("click", () => {
    choosePokemonFromSpecies(
      group,
      onSelect
    );
  });

  return card;
}
