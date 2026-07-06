(function (app) {
  "use strict";

  var dictionaries = {
    fa: {
      appTitle: "دفترچه نوت‌لایت",
      pageTitle: "دفترچه نوت‌لایت",
      appSubtitle: "یادداشت‌های ساده و امن",
      sidebarLabel: "نوار کناری یادداشت‌ها",
      editorToolbarLabel: "نوار ابزار قالب‌بندی",
      searchLabel: "جستجو",
      searchPlaceholder: "جستجو در یادداشت‌ها",
      newNote: "یادداشت جدید",
      newFolder: "پوشه جدید",
      sortLabel: "مرتب‌سازی",
      sortUpdated: "آخرین ویرایش",
      sortCreated: "جدیدترین",
      sortTitle: "عنوان",
      pinnedNotes: "سنجاق‌شده‌ها",
      folders: "پوشه‌ها",
      unfiledNotes: "بدون پوشه",
      searchResults: "نتایج جستجو",
      noPinned: "یادداشت سنجاق‌شده‌ای ندارید.",
      noFolders: "هنوز پوشه‌ای ساخته نشده است.",
      noFolderNotes: "این پوشه هنوز یادداشتی ندارد.",
      noUnfiled: "یادداشت بدون پوشه‌ای نیست.",
      noResults: "نتیجه‌ای پیدا نشد.",
      emptyTitle: "یک صفحه تازه بسازید",
      emptyText: "یادداشت‌ها، پوشه‌ها و تنظیمات شما در همین مرورگر ذخیره می‌شوند.",
      untitledNote: "یادداشت بدون عنوان",
      defaultFolderName: "پوشه جدید",
      noFolder: "بدون پوشه",
      edit: "ویرایش",
      saveExit: "ذخیره و خروج",
      delete: "حذف",
      pin: "سنجاق",
      unpin: "برداشتن سنجاق",
      rename: "تغییر نام",
      collapse: "بستن",
      expand: "باز کردن",
      created: "ساخته شده",
      updated: "به‌روزرسانی",
      titlePlaceholder: "عنوان یادداشت",
      contentPlaceholder: "متن Markdown را اینجا بنویسید...",
      folderLabel: "پوشه",
      toolbarBold: "پررنگ",
      toolbarItalic: "کج",
      toolbarUnderline: "زیرخط",
      toolbarColor: "رنگ متن",
      markdownHelp: "Markdown ساده: # عنوان، - فهرست، **پررنگ**، *کج*، `کد`، و لینک [متن](mailto:name@example.com)",
      selectTextHint: "برای قالب‌بندی ابتدا بخشی از متن را انتخاب کنید.",
      noteCreated: "یادداشت ساخته شد.",
      noteDeleted: "یادداشت حذف شد.",
      folderCreated: "پوشه ساخته شد.",
      folderRenamed: "نام پوشه تغییر کرد.",
      folderDeleted: "پوشه و یادداشت‌های داخل آن حذف شدند.",
      exportData: "خروجی JSON",
      importData: "ورودی JSON",
      importInvalid: "فایل انتخاب‌شده ساختار معتبری ندارد.",
      importSuccess: "داده‌ها با موفقیت جایگزین شدند.",
      exportSuccess: "خروجی آماده شد.",
      toggleTheme: "حالت تاریک",
      toggleThemeLight: "حالت روشن",
      toggleLanguage: "English",
      confirmDeleteNoteTitle: "حذف یادداشت؟",
      confirmDeleteNoteText: "این کار یادداشت انتخاب‌شده را حذف می‌کند و قابل بازگشت نیست.",
      confirmDeleteFolderTitle: "حذف پوشه؟",
      confirmDeleteFolderText: "این کار پوشه و همه یادداشت‌های داخل آن را حذف می‌کند.",
      confirmImportTitle: "جایگزینی همه داده‌ها؟",
      confirmImportText: "ورودی JSON همه داده‌های فعلی برنامه را جایگزین می‌کند و ادغام انجام نمی‌شود.",
      promptFolderTitle: "نام پوشه",
      promptFolderText: "نامی کوتاه و واضح وارد کنید.",
      promptRenameFolderTitle: "تغییر نام پوشه",
      cancel: "انصراف",
      confirm: "تایید",
      create: "ساختن",
      save: "ذخیره",
      folderNamePlaceholder: "نام پوشه",
      unsafeLink: "لینک نامعتبر",
      invalidImportDuplicateIds: "شناسه تکراری در فایل وجود دارد.",
      invalidImportShape: "ساختار فایل معتبر نیست."
    },
    en: {
      appTitle: "Notion Lite Notes",
      pageTitle: "Notion Lite Notes",
      appSubtitle: "Simple, safe notes",
      sidebarLabel: "Notes sidebar",
      editorToolbarLabel: "Formatting toolbar",
      searchLabel: "Search",
      searchPlaceholder: "Search notes",
      newNote: "New note",
      newFolder: "New folder",
      sortLabel: "Sort",
      sortUpdated: "Recently updated",
      sortCreated: "Newest created",
      sortTitle: "Title",
      pinnedNotes: "Pinned notes",
      folders: "Folders",
      unfiledNotes: "No folder",
      searchResults: "Search results",
      noPinned: "No pinned notes yet.",
      noFolders: "No folders yet.",
      noFolderNotes: "This folder has no notes yet.",
      noUnfiled: "No unfiled notes.",
      noResults: "No results found.",
      emptyTitle: "Create a fresh page",
      emptyText: "Your notes, folders, and preferences are stored in this browser.",
      untitledNote: "Untitled note",
      defaultFolderName: "New folder",
      noFolder: "No folder",
      edit: "Edit",
      saveExit: "Save & Exit",
      delete: "Delete",
      pin: "Pin",
      unpin: "Unpin",
      rename: "Rename",
      collapse: "Collapse",
      expand: "Expand",
      created: "Created",
      updated: "Updated",
      titlePlaceholder: "Note title",
      contentPlaceholder: "Write raw Markdown here...",
      folderLabel: "Folder",
      toolbarBold: "Bold",
      toolbarItalic: "Italic",
      toolbarUnderline: "Underline",
      toolbarColor: "Text color",
      markdownHelp: "Simple Markdown: # heading, - list, **bold**, *italic*, `code`, and [text](mailto:name@example.com)",
      selectTextHint: "Select some text before applying formatting.",
      noteCreated: "Note created.",
      noteDeleted: "Note deleted.",
      folderCreated: "Folder created.",
      folderRenamed: "Folder renamed.",
      folderDeleted: "Folder and its notes deleted.",
      exportData: "Export JSON",
      importData: "Import JSON",
      importInvalid: "The selected file is not a valid app export.",
      importSuccess: "Data replaced successfully.",
      exportSuccess: "Export is ready.",
      toggleTheme: "Dark mode",
      toggleThemeLight: "Light mode",
      toggleLanguage: "فارسی",
      confirmDeleteNoteTitle: "Delete note?",
      confirmDeleteNoteText: "This removes the selected note and cannot be undone.",
      confirmDeleteFolderTitle: "Delete folder?",
      confirmDeleteFolderText: "This removes the folder and every note inside it.",
      confirmImportTitle: "Replace all data?",
      confirmImportText: "The selected JSON file replaces the current app data. It will not merge.",
      promptFolderTitle: "Folder name",
      promptFolderText: "Enter a short, clear name.",
      promptRenameFolderTitle: "Rename folder",
      cancel: "Cancel",
      confirm: "Confirm",
      create: "Create",
      save: "Save",
      folderNamePlaceholder: "Folder name",
      unsafeLink: "Unsafe link",
      invalidImportDuplicateIds: "The file contains duplicate IDs.",
      invalidImportShape: "The file shape is invalid."
    }
  };

  function t(key) {
    var state = app.Store && app.Store.getState ? app.Store.getState() : null;
    var locale = state && state.settings ? state.settings.locale : "fa";
    return (dictionaries[locale] && dictionaries[locale][key]) || dictionaries.en[key] || key;
  }

  function applyDocumentLocale(locale) {
    var safeLocale = locale === "en" ? "en" : "fa";
    document.documentElement.lang = safeLocale;
    document.documentElement.dir = safeLocale === "fa" ? "rtl" : "ltr";
  }

  function localizeStatic() {
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
      node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria-label")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (node) {
      node.setAttribute("title", t(node.getAttribute("data-i18n-title")));
    });
  }

  app.I18nService = {
    t: t,
    applyDocumentLocale: applyDocumentLocale,
    localizeStatic: localizeStatic
  };
}(window.NotionLite));
