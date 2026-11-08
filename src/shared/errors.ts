// 服务端错误文案。每个错误有一个固定的 code，接口返回 { error: 中文说明, code, params, status }，
// 前端按 code 和当前语言翻译；/dl 的出错页按 cookie 或 Accept-Language 翻译。
// 加错误：在这里加一项，9 种语言都要写；再在 src/ 里 throw new HttpError(状态码, "新 code")。
// 文案里的 {name} 会被 params 里的同名值替换。
import type { Locale } from "./i18n.ts";

type Texts = Record<Locale, string>;

export const ERRORS = {
  generic: {
    zh: "出错了", en: "Something went wrong.", es: "Algo salió mal.", pt: "Algo deu errado.", ru: "Что-то пошло не так.",
    ja: "エラーが発生しました。", de: "Da ist etwas schiefgelaufen.", fr: "Une erreur est survenue.", id: "Terjadi kesalahan.",
  },
  network: {
    zh: "网络连接失败", en: "Couldn't connect. Check your network.", es: "No hay conexión. Revisa tu red.", pt: "Sem conexão. Verifique sua rede.",
    ru: "Нет соединения. Проверьте сеть.", ja: "接続できません。ネットワークを確認してください。", de: "Keine Verbindung. Prüfe dein Netzwerk.",
    fr: "Connexion impossible. Vérifiez votre réseau.", id: "Tidak bisa terhubung. Periksa jaringan Anda.",
  },
  server_error: {
    zh: "服务器出错了", en: "The server ran into a problem.", es: "El servidor tuvo un problema.", pt: "O servidor teve um problema.",
    ru: "На сервере произошла ошибка.", ja: "サーバーで問題が起きました。", de: "Auf dem Server ist ein Fehler aufgetreten.",
    fr: "Le serveur a rencontré un problème.", id: "Server mengalami masalah.",
  },
  bad_json: {
    zh: "请求内容不是有效的 JSON", en: "The request body isn't valid JSON.", es: "El cuerpo de la solicitud no es un JSON válido.",
    pt: "O corpo da requisição não é um JSON válido.", ru: "Тело запроса — не корректный JSON.", ja: "リクエストの内容が正しい JSON ではありません。",
    de: "Der Anfrageinhalt ist kein gültiges JSON.", fr: "Le corps de la requête n'est pas un JSON valide.", id: "Isi permintaan bukan JSON yang valid.",
  },
  bad_origin: {
    zh: "来源不对，拒绝跨站请求", en: "Cross-site request blocked.", es: "Solicitud entre sitios bloqueada.", pt: "Requisição entre sites bloqueada.",
    ru: "Межсайтовый запрос заблокирован.", ja: "別サイトからのリクエストは拒否されました。", de: "Websiteübergreifende Anfrage blockiert.",
    fr: "Requête intersite bloquée.", id: "Permintaan lintas situs diblokir.",
  },
  login_required: {
    zh: "请先登录", en: "Please sign in first.", es: "Inicia sesión primero.", pt: "Faça login primeiro.", ru: "Сначала войдите.",
    ja: "先にログインしてください。", de: "Bitte melde dich zuerst an.", fr: "Connectez-vous d'abord.", id: "Silakan masuk dulu.",
  },
  api_not_found: {
    zh: "接口不存在", en: "This API endpoint doesn't exist.", es: "Este endpoint de la API no existe.", pt: "Este endpoint da API não existe.",
    ru: "Такого адреса API нет.", ja: "この API は存在しません。", de: "Diesen API-Endpunkt gibt es nicht.", fr: "Ce point d'accès API n'existe pas.",
    id: "Endpoint API ini tidak ada.",
  },
  not_found: {
    zh: "找不到", en: "Not found.", es: "No se encontró.", pt: "Não encontrado.", ru: "Не найдено.", ja: "見つかりません。",
    de: "Nicht gefunden.", fr: "Introuvable.", id: "Tidak ditemukan.",
  },
  project_not_found: {
    zh: "项目不存在", en: "This project doesn't exist.", es: "Este proyecto no existe.", pt: "Este projeto não existe.", ru: "Такого проекта нет.",
    ja: "このプロジェクトは存在しません。", de: "Dieses Projekt gibt es nicht.", fr: "Ce projet n'existe pas.", id: "Proyek ini tidak ada.",
  },
  project_unpublished: {
    zh: "项目不存在或还没发布", en: "This project doesn't exist or hasn't been published.", es: "Este proyecto no existe o aún no se ha publicado.",
    pt: "Este projeto não existe ou ainda não foi publicado.", ru: "Проект не существует или ещё не опубликован.",
    ja: "このプロジェクトは存在しないか、まだ公開されていません。", de: "Dieses Projekt gibt es nicht oder es ist noch nicht veröffentlicht.",
    fr: "Ce projet n'existe pas ou n'est pas encore publié.", id: "Proyek ini tidak ada atau belum diterbitkan.",
  },
  slug_invalid: {
    zh: "短地址只能用小写字母、数字和横线，1 到 48 位，不能以横线开头或结尾",
    en: "The short link can only use lowercase letters, numbers and hyphens, 1–48 characters, and can't start or end with a hyphen.",
    es: "El enlace corto solo admite minúsculas, números y guiones, de 1 a 48 caracteres, y no puede empezar ni terminar con guion.",
    pt: "O link curto só aceita letras minúsculas, números e hífens, de 1 a 48 caracteres, e não pode começar nem terminar com hífen.",
    ru: "Короткая ссылка: только строчные латинские буквы, цифры и дефисы, от 1 до 48 символов, без дефиса в начале и в конце.",
    ja: "短縮 URL は小文字の英字・数字・ハイフンのみ、1〜48 文字で、先頭と末尾にハイフンは使えません。",
    de: "Der Kurzlink darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten, 1–48 Zeichen lang sein und nicht mit einem Bindestrich beginnen oder enden.",
    fr: "Le lien court ne peut contenir que des minuscules, des chiffres et des tirets (1 à 48 caractères), sans tiret au début ni à la fin.",
    id: "Tautan pendek hanya boleh huruf kecil, angka, dan tanda hubung, 1–48 karakter, dan tidak boleh diawali atau diakhiri tanda hubung.",
  },
  slug_taken: {
    zh: "这个短地址已经被别的项目用了", en: "Another project already uses this short link.", es: "Otro proyecto ya usa este enlace corto.",
    pt: "Outro projeto já usa este link curto.", ru: "Эта короткая ссылка уже занята другим проектом.", ja: "この短縮 URL は別のプロジェクトで使われています。",
    de: "Dieser Kurzlink wird schon von einem anderen Projekt verwendet.", fr: "Un autre projet utilise déjà ce lien court.",
    id: "Tautan pendek ini sudah dipakai proyek lain.",
  },
  title_invalid: {
    zh: "项目名不能为空，最多 100 字", en: "The project name can't be empty and can be at most 100 characters.",
    es: "El nombre del proyecto no puede estar vacío y admite hasta 100 caracteres.", pt: "O nome do projeto não pode ficar vazio e aceita até 100 caracteres.",
    ru: "Название проекта не может быть пустым, максимум 100 символов.", ja: "プロジェクト名は必須で、100 文字までです。",
    de: "Der Projektname darf nicht leer sein und höchstens 100 Zeichen haben.", fr: "Le nom du projet est obligatoire, 100 caractères maximum.",
    id: "Nama proyek wajib diisi, maksimal 100 karakter.",
  },
  description_too_long: {
    zh: "简介最多 1000 字", en: "The description can be at most 1,000 characters.", es: "La descripción admite hasta 1000 caracteres.",
    pt: "A descrição aceita até 1.000 caracteres.", ru: "Описание — не больше 1000 символов.", ja: "説明は 1000 文字までです。",
    de: "Die Beschreibung darf höchstens 1000 Zeichen haben.", fr: "La description ne peut pas dépasser 1 000 caractères.",
    id: "Deskripsi maksimal 1.000 karakter.",
  },
  code_required_bool: {
    zh: "codeRequired 只能是 true 或 false", en: "codeRequired must be true or false.", es: "codeRequired debe ser true o false.",
    pt: "codeRequired precisa ser true ou false.", ru: "codeRequired должно быть true или false.", ja: "codeRequired は true か false で指定してください。",
    de: "codeRequired muss true oder false sein.", fr: "codeRequired doit valoir true ou false.", id: "codeRequired harus true atau false.",
  },
  max_downloads_invalid: {
    zh: "下载上限要是 1 到 1000000 的整数，不限就留空", en: "The download limit must be a whole number from 1 to 1,000,000. Leave it empty for no limit.",
    es: "El límite de descargas debe ser un número entero entre 1 y 1 000 000. Déjalo vacío para no poner límite.",
    pt: "O limite de downloads precisa ser um número inteiro de 1 a 1.000.000. Deixe vazio para não ter limite.",
    ru: "Лимит скачиваний — целое число от 1 до 1 000 000. Оставьте пустым, чтобы не ограничивать.",
    ja: "ダウンロード上限は 1〜1000000 の整数で入力してください。無制限にするなら空欄のままにします。",
    de: "Das Download-Limit muss eine ganze Zahl von 1 bis 1.000.000 sein. Leer lassen für kein Limit.",
    fr: "La limite de téléchargements doit être un nombre entier entre 1 et 1 000 000. Laissez vide pour ne pas limiter.",
    id: "Batas unduhan harus bilangan bulat 1 sampai 1.000.000. Kosongkan jika tanpa batas.",
  },
  status_invalid: {
    zh: "状态只能是 draft 或 published", en: "Status must be draft or published.", es: "El estado debe ser draft o published.",
    pt: "O status precisa ser draft ou published.", ru: "Статус может быть только draft или published.", ja: "状態は draft か published で指定してください。",
    de: "Der Status muss draft oder published sein.", fr: "Le statut doit être draft ou published.", id: "Status harus draft atau published.",
  },
  publish_empty: {
    zh: "项目里还没有图片，不能发布", en: "Add some images before publishing.", es: "Añade imágenes antes de publicar.",
    pt: "Adicione imagens antes de publicar.", ru: "Сначала добавьте изображения, потом публикуйте.", ja: "画像がないので公開できません。",
    de: "Füge erst Bilder hinzu, dann kannst du veröffentlichen.", fr: "Ajoutez des images avant de publier.", id: "Tambahkan gambar dulu sebelum menerbitkan.",
  },
  file_too_large: {
    zh: "单张原图最大 95MB", en: "Each original can be at most 95 MB.", es: "Cada original puede pesar como máximo 95 MB.",
    pt: "Cada original pode ter no máximo 95 MB.", ru: "Каждый оригинал — не больше 95 МБ.", ja: "元画像は 1 枚 95MB までです。",
    de: "Jedes Original darf höchstens 95 MB groß sein.", fr: "Chaque original peut faire 95 Mo au maximum.", id: "Setiap file asli maksimal 95 MB.",
  },
  preview_too_large: {
    zh: "预览图太大", en: "The preview image is too large.", es: "La vista previa es demasiado grande.", pt: "A prévia é grande demais.",
    ru: "Превью слишком большое.", ja: "プレビュー画像が大きすぎます。", de: "Das Vorschaubild ist zu groß.", fr: "L'aperçu est trop volumineux.",
    id: "Gambar pratinjau terlalu besar.",
  },
  bad_upload: {
    zh: "上传内容格式不对", en: "The upload isn't in the expected format.", es: "La subida no tiene el formato esperado.",
    pt: "O envio não está no formato esperado.", ru: "Загрузка в неверном формате.", ja: "アップロードの形式が正しくありません。",
    de: "Der Upload hat nicht das erwartete Format.", fr: "L'envoi n'a pas le format attendu.", id: "Format unggahan tidak sesuai.",
  },
  missing_files: {
    zh: "缺少原图、马赛克图或缩略图", en: "The original, mosaic or thumbnail is missing.", es: "Falta el original, el mosaico o la miniatura.",
    pt: "Está faltando o original, o mosaico ou a miniatura.", ru: "Не хватает оригинала, мозаики или миниатюры.", ja: "元画像、モザイク画像、サムネイルのどれかがありません。",
    de: "Original, Mosaik oder Vorschaubild fehlt.", fr: "Il manque l'original, la mosaïque ou la miniature.", id: "File asli, mosaik, atau thumbnail tidak ada.",
  },
  unsupported_type: {
    zh: "只支持 JPEG、PNG、WebP、AVIF、GIF", en: "Only JPEG, PNG, WebP, AVIF and GIF are supported.", es: "Solo se admiten JPEG, PNG, WebP, AVIF y GIF.",
    pt: "Só JPEG, PNG, WebP, AVIF e GIF são aceitos.", ru: "Поддерживаются только JPEG, PNG, WebP, AVIF и GIF.", ja: "対応形式は JPEG、PNG、WebP、AVIF、GIF だけです。",
    de: "Nur JPEG, PNG, WebP, AVIF und GIF werden unterstützt.", fr: "Seuls JPEG, PNG, WebP, AVIF et GIF sont pris en charge.",
    id: "Hanya JPEG, PNG, WebP, AVIF, dan GIF yang didukung.",
  },
  missing_size: {
    zh: "缺少图片宽高", en: "Image width and height are missing.", es: "Faltan el ancho y el alto de la imagen.", pt: "Faltam a largura e a altura da imagem.",
    ru: "Не указаны ширина и высота изображения.", ja: "画像の幅と高さがありません。", de: "Breite und Höhe des Bildes fehlen.",
    fr: "Il manque la largeur et la hauteur de l'image.", id: "Lebar dan tinggi gambar tidak ada.",
  },
  image_not_found: {
    zh: "图片不存在", en: "This image doesn't exist.", es: "Esta imagen no existe.", pt: "Esta imagem não existe.", ru: "Такого изображения нет.",
    ja: "この画像は存在しません。", de: "Dieses Bild gibt es nicht.", fr: "Cette image n'existe pas.", id: "Gambar ini tidak ada.",
  },
  file_not_found: {
    zh: "文件不存在", en: "The file doesn't exist.", es: "El archivo no existe.", pt: "O arquivo não existe.", ru: "Файл не найден.",
    ja: "ファイルが存在しません。", de: "Die Datei gibt es nicht.", fr: "Le fichier n'existe pas.", id: "File tidak ada.",
  },
  original_missing: {
    zh: "原图文件不存在", en: "The original file is missing.", es: "Falta el archivo original.", pt: "O arquivo original não existe.",
    ru: "Файл оригинала не найден.", ja: "元画像のファイルがありません。", de: "Die Originaldatei fehlt.", fr: "Le fichier original est introuvable.",
    id: "File asli tidak ada.",
  },
  order_missing: {
    zh: "缺少排序", en: "The new order is missing.", es: "Falta el nuevo orden.", pt: "Falta a nova ordem.", ru: "Не передан новый порядок.",
    ja: "並び順がありません。", de: "Die neue Reihenfolge fehlt.", fr: "Le nouvel ordre est manquant.", id: "Urutan baru tidak ada.",
  },
  code_count_invalid: {
    zh: "一次生成 1 到 500 个", en: "You can generate 1 to 500 codes at a time.", es: "Puedes generar de 1 a 500 códigos a la vez.",
    pt: "Você pode gerar de 1 a 500 códigos por vez.", ru: "За раз можно создать от 1 до 500 кодов.", ja: "一度に作れるのは 1〜500 個です。",
    de: "Du kannst 1 bis 500 Codes auf einmal erstellen.", fr: "Vous pouvez générer de 1 à 500 codes à la fois.", id: "Sekali buat bisa 1 sampai 500 kode.",
  },
  expiry_hours_invalid: {
    zh: "有效小时数不对", en: "The number of hours isn't valid.", es: "El número de horas no es válido.", pt: "O número de horas não é válido.",
    ru: "Неверное число часов.", ja: "有効時間の値が正しくありません。", de: "Die Stundenzahl ist ungültig.", fr: "Le nombre d'heures n'est pas valide.",
    id: "Jumlah jam tidak valid.",
  },
  expiry_in_past: {
    zh: "过期时间要晚于现在", en: "The expiry time must be in the future.", es: "La fecha de caducidad tiene que ser futura.",
    pt: "A data de expiração precisa estar no futuro.", ru: "Срок действия должен быть в будущем.", ja: "有効期限は今より後にしてください。",
    de: "Der Ablaufzeitpunkt muss in der Zukunft liegen.", fr: "La date d'expiration doit être dans le futur.", id: "Waktu kedaluwarsa harus setelah sekarang.",
  },
  no_codes_selected: {
    zh: "没有选中获取码", en: "No codes selected.", es: "No hay códigos seleccionados.", pt: "Nenhum código selecionado.", ru: "Коды не выбраны.",
    ja: "コードが選ばれていません。", de: "Keine Codes ausgewählt.", fr: "Aucun code sélectionné.", id: "Belum ada kode yang dipilih.",
  },
  rate_limited: {
    zh: "试得太频繁了，请一分钟后再试", en: "Too many tries. Please wait a minute and try again.", es: "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
    pt: "Muitas tentativas. Espere um minuto e tente de novo.", ru: "Слишком много попыток. Подождите минуту и попробуйте снова.",
    ja: "試行回数が多すぎます。1 分ほど待ってからもう一度お試しください。", de: "Zu viele Versuche. Warte eine Minute und versuch es dann noch einmal.",
    fr: "Trop de tentatives. Patientez une minute puis réessayez.", id: "Terlalu sering mencoba. Tunggu satu menit lalu coba lagi.",
  },
  code_wrong: {
    zh: "获取码不对", en: "That code isn't right.", es: "Ese código no es correcto.", pt: "Esse código não está certo.", ru: "Код неверный.",
    ja: "コードが正しくありません。", de: "Dieser Code stimmt nicht.", fr: "Ce code n'est pas bon.", id: "Kode itu salah.",
  },
  code_revoked: {
    zh: "获取码已作废", en: "This code has been revoked.", es: "Este código fue anulado.", pt: "Este código foi revogado.", ru: "Этот код отозван.",
    ja: "このコードは無効化されています。", de: "Dieser Code wurde widerrufen.", fr: "Ce code a été révoqué.", id: "Kode ini sudah dicabut.",
  },
  code_expired: {
    zh: "获取码已过期", en: "This code has expired.", es: "Este código ha caducado.", pt: "Este código expirou.", ru: "Срок действия кода истёк.",
    ja: "このコードは期限切れです。", de: "Dieser Code ist abgelaufen.", fr: "Ce code a expiré.", id: "Kode ini sudah kedaluwarsa.",
  },
  thumb_forbidden: {
    zh: "下载过这张图才能看缩略图", en: "Download this image first to see its thumbnail.", es: "Descarga esta imagen primero para ver su miniatura.",
    pt: "Baixe esta imagem primeiro para ver a miniatura.", ru: "Миниатюра доступна только после скачивания изображения.",
    ja: "この画像をダウンロードするとサムネイルが見られます。", de: "Lade das Bild zuerst herunter, um das Vorschaubild zu sehen.",
    fr: "Téléchargez d'abord cette image pour voir sa miniature.", id: "Unduh gambar ini dulu untuk melihat thumbnail-nya.",
  },
  already_downloaded: {
    zh: "这张图已经用这个码下载过了", en: "This image has already been downloaded with this code.", es: "Ya descargaste esta imagen con este código.",
    pt: "Esta imagem já foi baixada com este código.", ru: "Это изображение уже скачано по этому коду.", ja: "この画像はこのコードでダウンロード済みです。",
    de: "Dieses Bild wurde mit diesem Code schon heruntergeladen.", fr: "Cette image a déjà été téléchargée avec ce code.",
    id: "Gambar ini sudah diunduh dengan kode ini.",
  },
  code_needed: {
    zh: "这个项目要获取码才能下载", en: "This project needs an access code to download.", es: "Este proyecto necesita un código de acceso para descargar.",
    pt: "Este projeto precisa de um código de acesso para baixar.", ru: "Для скачивания в этом проекте нужен код доступа.",
    ja: "このプロジェクトはダウンロードにコードが必要です。", de: "Für Downloads in diesem Projekt brauchst du einen Zugangscode.",
    fr: "Ce projet demande un code d'accès pour télécharger.", id: "Proyek ini butuh kode akses untuk mengunduh.",
  },
  free_exhausted: {
    zh: "这个项目的下载次数已经用完了", en: "This project has used up all its downloads.", es: "Este proyecto ya agotó sus descargas.",
    pt: "Este projeto já esgotou os downloads.", ru: "Лимит скачиваний в этом проекте исчерпан.", ja: "このプロジェクトのダウンロード回数は上限に達しました。",
    de: "Die Downloads für dieses Projekt sind aufgebraucht.", fr: "Ce projet a épuisé tous ses téléchargements.", id: "Jatah unduhan proyek ini sudah habis.",
  },
  ticket_invalid: {
    zh: "下载链接已失效", en: "This download link is no longer valid.", es: "Este enlace de descarga ya no es válido.", pt: "Este link de download não é mais válido.",
    ru: "Ссылка на скачивание больше не действует.", ja: "このダウンロードリンクは無効です。", de: "Dieser Download-Link ist nicht mehr gültig.",
    fr: "Ce lien de téléchargement n'est plus valable.", id: "Tautan unduhan ini sudah tidak berlaku.",
  },
  ticket_expired: {
    zh: "下载链接已失效，回到项目页重新点下载", en: "This download link is no longer valid. Go back to the project page and click download again.",
    es: "Este enlace de descarga ya no es válido. Vuelve a la página del proyecto y pulsa descargar otra vez.",
    pt: "Este link de download não é mais válido. Volte à página do projeto e clique em baixar de novo.",
    ru: "Ссылка на скачивание больше не действует. Вернитесь на страницу проекта и нажмите «Скачать» ещё раз.",
    ja: "このダウンロードリンクは無効です。プロジェクトのページに戻って、もう一度ダウンロードしてください。",
    de: "Dieser Download-Link ist nicht mehr gültig. Geh zurück zur Projektseite und klick noch einmal auf Herunterladen.",
    fr: "Ce lien de téléchargement n'est plus valable. Revenez sur la page du projet et cliquez de nouveau sur Télécharger.",
    id: "Tautan unduhan ini sudah tidak berlaku. Kembali ke halaman proyek dan klik unduh lagi.",
  },
} satisfies Record<string, Texts>;

export type ErrorCode = keyof typeof ERRORS;
export type ErrorParams = Record<string, string | number>;

export const isErrorCode = (v: unknown): v is ErrorCode => typeof v === "string" && Object.hasOwn(ERRORS, v);

export function errorText(locale: Locale, code: ErrorCode, params?: ErrorParams): string {
  const s = ERRORS[code][locale] ?? ERRORS[code].en;
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}
