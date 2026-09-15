(function () {

  function getParties() {
    return JSON.parse(
      localStorage.getItem("gawhota_parties") || "[]"
    );
  }

  function getMatches() {
    return JSON.parse(
      localStorage.getItem("gawhota_matches") || "[]"
    );
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value);

    return `"${text.replaceAll('"', '""')}"`;
  }

  function findPokemonName(id, team) {
    const p = team.find(p => p.id === id);
    return p ? p.display_name : id;
  }

  function exportAllJson() {
    const data = {
      version: 1,

      exported_at:
        new Date().toISOString(),

      parties:
        getParties(),

      matches:
        getMatches()
    };

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    downloadFile(
      `gawhota_selection_backup_${date}.json`,
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8"
    );
  }

  async function exportAllCsv() {
    const parties = getParties();
    const partyId = app.dataset.partyId;

    let pokemonData = [];
    let itemsData = {};

    try {
      const [
        pokemonResponse,
        itemsResponse
      ] = await Promise.all([
        fetch("../data/pokemon.json"),
        fetch("../data/items.json")
      ]);

      if (
        !pokemonResponse.ok ||
        !itemsResponse.ok
      ) {
        throw new Error(
          "Master data fetch failed"
        );
      }

      pokemonData =
        await pokemonResponse.json();

      itemsData =
        await itemsResponse.json();

    } catch (error) {
      console.error(
        "CSV Master data load error:",
        error
      );

      alert(
        "CSV書き出しに必要なデータを読み込めませんでした。"
      );

      return;
    }

    if (!partyId) {
      alert("構築を選択してください。");
      return;
    }

    const matches =
      getMatches().filter(
        match => match.party_id === partyId
      );

    const headers = [
      "match_id",
      "played_at",
      "party_id",
      "party_name",

      "my_team_1",
      "my_team_2",
      "my_team_3",
      "my_team_4",
      "my_team_5",
      "my_team_6",

      "my_lead_1",
      "my_lead_2",
      "my_back_1",
      "my_back_2",

      "opponent_team_1",
      "opponent_team_2",
      "opponent_team_3",
      "opponent_team_4",
      "opponent_team_5",
      "opponent_team_6",

      "opponent_lead_1",
      "opponent_lead_2",
      "opponent_back_1",
      "opponent_back_2",

      "result",
      "memo",

      "opponent_revealed_forms",
      "opponent_revealed_items"
    ];

    const rows = [headers];

    matches.forEach(match => {

      const party =
        parties.find(
          p => p.id === match.party_id
        );

      if (!party) return;

      const myTeam =
        party.pokemon || [];

      const opponentTeam =
        match.opponent_team || [];

      const myLead =
        (match.my_lead || [])
          .map(id =>
            findPokemonName(id, myTeam)
          );

      const myBack =
        (match.my_back || [])
          .map(id =>
            findPokemonName(id, myTeam)
          );

      const opponentLead =
        (match.opponent_lead || [])
          .map(id =>
            findPokemonName(id, opponentTeam)
          );

      const opponentBack =
        (match.opponent_back || [])
          .map(id =>
            findPokemonName(id, opponentTeam)
          );

      const revealedInfo =
        match.revealed_info || {};

      const revealedForms =
        opponentTeam
          .map(p => {
            const formId =
              revealedInfo[p.id]?.form_id;

            if (!formId) return "";

            const form =
              pokemonData.find(
                x => x.id === formId
              );

            if (!form) return "";

            return (
              p.display_name +
              "=" +
              form.display_name
            );
          })
          .filter(Boolean)
          .join(" / ");

      const revealedItems =
        opponentTeam
          .map(p => {
            const itemId =
              revealedInfo[p.id]?.item_id;

            if (!itemId) return "";

            const item =
              itemsData[itemId];

            if (!item) return "";

            const itemName =
              item.name?.ja ||
              item.name?.en ||
              item.display_name ||
              itemId;

            return (
              p.display_name +
              "=" +
              itemName
            );
          })
          .filter(Boolean)
          .join(" / ");

      rows.push([
        match.id,
        match.played_at,

        party.id,
        party.name,

        ...Array.from(
          { length: 6 },
          (_, i) =>
            myTeam[i]?.display_name || ""
        ),

        myLead[0] || "",
        myLead[1] || "",

        myBack[0] || "",
        myBack[1] || "",

        ...Array.from(
          { length: 6 },
          (_, i) =>
            opponentTeam[i]?.display_name || ""
        ),

        opponentLead[0] || "",
        opponentLead[1] || "",

        opponentBack[0] || "",
        opponentBack[1] || "",

        match.result,
        match.memo || "",

        revealedForms,
        revealedItems
      ]);
    });

    const csv =
      "\uFEFF" +
      rows
        .map(row =>
          row.map(csvEscape).join(",")
        )
        .join("\n");

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    downloadFile(
      `gawhota_selection_data_${date}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );

    /*
     * =====================================================
     * 構築詳細CSV
     *
     * 1行 = 構築内の1ポケモン。
     * 対戦CSVの party_id と結合できる。
     * =====================================================
     */

    const [
      abilitiesRes,
      movesRes
    ] = await Promise.all([
      fetch("../data/abilities.json"),
      fetch("../data/moves.json")
    ]);

    const abilitiesData =
      await abilitiesRes.json();

    const movesData =
      await movesRes.json();


    const normalizeMasterText = value =>
      String(value || "")
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, " ");


    const findMasterEntry = (
      master,
      value
    ) => {
      if (!value) return null;

      if (master[value]) {
        return {
          id: value,
          ...master[value]
        };
      }

      const needle =
        normalizeMasterText(value);

      for (
        const [id, entry]
        of Object.entries(master)
      ) {
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
    };


    const getMasterJa = (
      master,
      value
    ) => {
      const entry =
        findMasterEntry(
          master,
          value
        );

      return (
        entry?.name?.ja ||
        entry?.name_ja ||
        value ||
        ""
      );
    };


    const getMasterId = (
      master,
      value
    ) => {
      return (
        findMasterEntry(
          master,
          value
        )?.id ||
        ""
      );
    };


    const partyHeaders = [
      "party_id",
      "party_name",
      "slot",

      "pokemon_id",
      "species_id",
      "pokemon_name",

      "item_id",
      "item_name",

      "ability_id",
      "ability_name",

      "nature",
      "level",

      "hp",
      "atk",
      "def",
      "spa",
      "spd",
      "spe",

      "move1_id",
      "move1_name",

      "move2_id",
      "move2_name",

      "move3_id",
      "move3_name",

      "move4_id",
      "move4_name"
    ];

    const partyRows = [
      partyHeaders
    ];


    parties.forEach(party => {
      const team =
        Array.isArray(party.pokemon)
          ? party.pokemon
          : [];

      team.forEach(
        (p, index) => {

          const item =
            p.item_id
              ? itemsData[p.item_id]
              : null;

          const itemName =
            item?.name?.ja ||
            item?.name?.en ||
            item?.display_name ||
            p.item_id ||
            "";

          const abilityId =
            getMasterId(
              abilitiesData,
              p.ability
            );

          const abilityName =
            getMasterJa(
              abilitiesData,
              p.ability
            );

          const evs =
            p.evs || {};

          const pokemonMoves =
            Array.isArray(p.moves)
              ? p.moves.slice(0, 4)
              : [];

          while (
            pokemonMoves.length < 4
          ) {
            pokemonMoves.push("");
          }

          const moveValues =
            pokemonMoves.flatMap(
              move => [
                getMasterId(
                  movesData,
                  move
                ),

                getMasterJa(
                  movesData,
                  move
                )
              ]
            );

          partyRows.push([
            party.id,
            party.name,
            index + 1,

            p.id || "",
            p.species_id || "",
            p.display_name || "",

            p.item_id || "",
            itemName,

            abilityId,
            abilityName,

            p.nature || "",
            p.level || 50,

            evs.hp ?? 0,
            evs.atk ?? 0,
            evs.def ?? 0,
            evs.spa ?? 0,
            evs.spd ?? 0,
            evs.spe ?? 0,

            ...moveValues
          ]);
        }
      );
    });


    const partyCsv =
      "\uFEFF" +
      partyRows
        .map(row =>
          row
            .map(csvEscape)
            .join(",")
        )
        .join("\n");


    downloadFile(
      `gawhota_parties_${date}.csv`,
      partyCsv,
      "text/csv;charset=utf-8"
    );
  }

  /*
   * app.js が後から生成するボタンにも対応するため、
   * documentでクリックを受ける。
   */
  document.addEventListener(
    "click",
    event => {
      const csvButton =
        event.target.closest("#exportCsvMenu");

      if (csvButton) {
        event.preventDefault();
        exportAllCsv();
        return;
      }

      const jsonButton =
        event.target.closest("#exportJsonMenu");

      if (jsonButton) {
        event.preventDefault();
        exportJsonBackup();
      }
    }
  );

})();
