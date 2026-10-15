(() => {
  const config = window.GAWHOTA_SUPABASE;

  const WORKSPACE_KEY = "gawhota_workspace_id";
  const PAIRING_CODE_KEY = "gawhota_pairing_code";

  if (!config?.url || !config?.publishableKey) {
    document.getElementById("app").innerHTML =
      "<p>Supabaseの設定を読み込めませんでした。</p>";
    return;
  }

  const client = window.supabase.createClient(
    config.url,
    config.publishableKey
  );

  window.GAWHOTA_SUPABASE_CLIENT = client;

  function hasExistingTrackerData() {
    try {
      const parties =
        JSON.parse(localStorage.getItem("gawhota_parties") || "[]");
      const matches =
        JSON.parse(localStorage.getItem("gawhota_matches") || "[]");

      return parties.length > 0 || matches.length > 0;
    } catch {
      return false;
    }
  }

  function normalizePairingCode(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^0-9a-f]/g, "");
  }

  async function ensureAnonymousSession() {
    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error) throw error;

    if (session) return session;

    const result = await client.auth.signInAnonymously();

    if (result.error) throw result.error;

    return result.data.session;
  }

  async function createWorkspace() {
    const { data, error } =
      await client.rpc("create_personal_workspace");

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.workspace_id) {
      throw new Error("workspaceの作成結果を取得できませんでした");
    }

    localStorage.setItem(
      WORKSPACE_KEY,
      row.workspace_id
    );

    if (row.pairing_code) {
      localStorage.setItem(
        PAIRING_CODE_KEY,
        row.pairing_code
      );
    }

    return row.workspace_id;
  }

  async function joinWorkspace(pairingCode) {
    const code = normalizePairingCode(pairingCode);

    if (!code) {
      throw new Error("連携コードを入力してください");
    }

    const { data, error } =
      await client.rpc(
        "join_personal_workspace",
        { input_pairing_code: code }
      );

    if (error) throw error;

    if (!data) {
      throw new Error("workspaceを取得できませんでした");
    }

    localStorage.setItem(
      WORKSPACE_KEY,
      data
    );

    localStorage.setItem(
      PAIRING_CODE_KEY,
      code
    );

    return data;
  }

  async function getPairingCode(workspaceId) {
    const cached =
      localStorage.getItem(PAIRING_CODE_KEY);

    if (cached) return cached;

    const { data, error } =
      await client.rpc(
        "get_my_pairing_code",
        { input_workspace_id: workspaceId }
      );

    if (error) throw error;

    if (data) {
      localStorage.setItem(
        PAIRING_CODE_KEY,
        data
      );
    }

    return data;
  }

  async function startTracker(workspaceId) {
    window.GAWHOTA_WORKSPACE_ID = workspaceId;

    window.GAWHOTA_GET_PAIRING_CODE =
      async () => getPairingCode(workspaceId);

    while (
      typeof window.GAWHOTA_START_TRACKER !== "function"
    ) {
      await new Promise(
        resolve => setTimeout(resolve, 20)
      );
    }

    await window.GAWHOTA_START_TRACKER();
  }

  function renderPairingScreen() {
    const app = document.getElementById("app");

    app.innerHTML = `
      <div style="
        max-width:520px;
        margin:60px auto;
        padding:24px;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      ">
        <h1 style="margin-bottom:8px;">
          Selection Tracker
        </h1>

        <p style="
          color:#666;
          line-height:1.6;
          margin-bottom:28px;
        ">
          この端末を、Mac / iPad / iPhone 共通の
          データに接続します。
        </p>

        <button
          id="gawhotaCreateWorkspace"
          style="
            width:100%;
            padding:14px;
            margin-bottom:24px;
            font-size:16px;
          "
        >
          新しいデータを作る
        </button>

        <div style="
          border-top:1px solid #ddd;
          padding-top:24px;
        ">
          <p>
            すでにMacなどで使っている場合
          </p>

          <input
            id="gawhotaPairingCode"
            placeholder="連携コード"
            autocomplete="off"
            autocapitalize="none"
            style="
              width:100%;
              box-sizing:border-box;
              padding:12px;
              margin:8px 0 12px;
              font-size:16px;
            "
          >

          <button
            id="gawhotaJoinWorkspace"
            style="
              width:100%;
              padding:14px;
              font-size:16px;
            "
          >
            この端末を連携
          </button>
        </div>

        <p
          id="gawhotaPairingMessage"
          style="
            margin-top:18px;
            color:#b00020;
            white-space:pre-wrap;
          "
        ></p>
      </div>
    `;

    const message =
      document.getElementById(
        "gawhotaPairingMessage"
      );

    document.getElementById(
      "gawhotaCreateWorkspace"
    ).onclick = async () => {
      message.textContent = "作成中…";

      try {
        const workspaceId =
          await createWorkspace();

        await startTracker(workspaceId);
      } catch (error) {
        console.error(error);
        message.textContent =
          `作成失敗: ${error.message}`;
      }
    };

    document.getElementById(
      "gawhotaJoinWorkspace"
    ).onclick = async () => {
      message.textContent = "接続中…";

      try {
        const value =
          document.getElementById(
            "gawhotaPairingCode"
          ).value;

        const workspaceId =
          await joinWorkspace(value);

        await startTracker(workspaceId);
      } catch (error) {
        console.error(error);
        message.textContent =
          `連携失敗: ${error.message}`;
      }
    };
  }

  async function boot() {
    try {
      await ensureAnonymousSession();

      let workspaceId =
        localStorage.getItem(WORKSPACE_KEY);

      if (workspaceId) {
        await startTracker(workspaceId);
        return;
      }

      /*
       * workspace未設定の端末では、
       * 古いLocalStorageが残っていても自動作成しない。
       *
       * Macはすでにworkspace_idを保存済みなので
       * ここには来ない。
       *
       * iPhone / iPadは必ず連携画面を表示する。
       */
      renderPairingScreen();

    } catch (error) {
      console.error(
        "Gawhota boot error:",
        error
      );

      document.getElementById("app").innerHTML =
        `<p style="padding:24px;">
          Selection Trackerの起動に失敗しました。<br>
          ${String(error.message || error)}
        </p>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once:true }
    );
  } else {
    boot();
  }
})();
