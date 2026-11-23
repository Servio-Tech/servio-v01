# جرد ترحيلات SERVIO وخطة الرجوع — 2026-11-23

## الحالة الحالية

المشروع الإنتاجي `Servio_V1.0` لم تُطبّق عليه هذه الترحيلات الـ11، ولم تُنشر Edge Functions الجديدة، ولم يُدمج PR #32 إلى `main`. لذلك لا يوجد الآن object من هذه القائمة ينبغي حذفه من Production؛ القائمة أدناه استباقية لما قد يُنشأ إذا طُبّقت الترحيلات لاحقًا. ولا يُعدّ إسقاط الجداول والدوال الجديدة وحده rollback كاملًا.

لم تُعدّ خطة تنفيذ rollback كاملة أو مجرّبة؛ ملفات الترحيلات وحدها لا تحفظ كل تعريفات ما قبل التغيير ولا كل بيانات الحالة. لم يُنشأ backup، استجابةً لطلب المستخدم، ولم يتم إثبات إمكانية استعادة الـbackup السابق. لا تُجرَ كتابة إنتاجية اعتمادًا على هذا المستند وحده.

## الجرد حسب ترتيب الترحيل

### 1. `20261121130000_tenant_subscriptions_and_branch_limits.sql`

**كائنات جديدة:** جدول `public.tenant_subscriptions`، والقيد `public.tenants.tenants_owner_console_slug_reserved`، وسياسة `tenant_subscriptions_member_read`، والدوال `public.enforce_subscription_branch_limit()`, `public.initialize_tenant_subscription_and_branch()`, `public.owner_set_subscription(uuid,text,timestamptz,timestamptz)`، والمشغّلان `enforce_subscription_branch_limit_before_write` على `public.branches` و`initialize_tenant_subscription_and_branch_after_insert` على `public.tenants`.

**تعريف مستبدل/آثار بيانات:** استبدال `public.ensure_profile_for_current_user()` وتغيير صلاحياته. تُملأ اشتراكات tenants القائمة، ويُنشأ فرع باسم `main` لكل tenant لا يملك فرعًا.

**ما يمكن إسقاطه عند الرجوع:** بعد فك اعتماديات الإصدارات اللاحقة، يمكن إسقاط السياسة والمشغّلين والدوال والقيد والجدول؛ لكن لا يُسقط الجدول قبل حفظ/تسوية بيانات الاشتراك، ولا تحذف فروع `main` إلا بعد تحديد الفروع التي أنشأها هذا الترحيل وتمييزها من الفروع المنشأة لاحقًا. يجب استعادة تعريف `ensure_profile_for_current_user()` السابق، لا إسقاط الدالة. لا توجد علامة تميّز تلقائيًا الفروع التي أضافها الترحيل.

### 2. `20261122020000_owner_user_blocks.sql`

**جداول جديدة:** `public.platform_user_blocks`, `public.platform_user_session_fences`, `public.platform_owner_audit`, `public.platform_owner_deletion_requests`.

**دوال جديدة:** `platform_current_user_allowed()`, `platform_guard_blocked_push()`, `platform_block_request_guard()`, `platform_block_guard_status()`, `platform_require_owner(uuid)`, `platform_owner_audit_event(uuid,uuid,uuid,text,text)`, `platform_begin_block_operation(uuid,uuid,text,uuid)`, `platform_finish_block_operation(uuid,uuid,text,uuid)`, `platform_owner_user_details(uuid[])`, `platform_prepare_user_deletion(uuid,uuid)`, `platform_check_user_deletion(uuid)`, `platform_guard_owner_user_deletion()`, `platform_finish_user_deletion(uuid,uuid,boolean)`، وكلها في `public`.

**مشغّلات جديدة:** `platform_guard_blocked_push` على `public.notification_deliveries`، و`platform_guard_owner_user_deletion` على `auth.users`.

**سياسات/إعدادات وآثار:** تفعيل RLS وضبط ACL للجداول الجديدة. تنشئ حلقة سياسات `platform_user_not_blocked` على كل جدول/جدول مقسّم في `public` ذي RLS، وقد تستبدل سياسة سابقة بالاسم نفسه لأنها تنفذ `DROP POLICY IF EXISTS`. يتغير إعداد الدور `authenticator`، `pgrst.db_pre_request` إلى `public.platform_block_request_guard`، ثم ترسل إشعارات PostgREST. كما أن دالة بدء الحظر تحذف صفوفًا من `auth.sessions`.

**ما يمكن إسقاطه عند الرجوع:** يمكن إسقاط الدوال والمشغّلات والسياسات التي ثبت أنها أُنشئت هنا، ثم الجداول الجديدة بعد تصدير بيانات الحظر والتدقيق وطلبات الحذف وأسوار الجلسات، وفحص ما إذا كانت هذه الحالة لا تزال مستخدمة. يجب استعادة أي سياسة سابقة باسم `platform_user_not_blocked`، واستعادة القيمة الفعلية السابقة لـ`pgrst.db_pre_request`. حذف جلسات Auth لا يمكن عكسه باستعادة تعريفات SQL. أسماء كل الجداول التي طالتها حلقة السياسات تتطلب جرد catalog وقت التنفيذ.

### 3. `20261122030000_enforce_subscription_dates.sql`

**جديد:** schema `servio_subscription_private`، والدوال `public.platform_subscription_tenant_active(uuid)`, `public.platform_subscription_slug_active(text)`, `public.platform_subscription_current_user_allowed()`، ونسخ خاصة من دوال `SECURITY DEFINER` تختارها الحلقة وفق catalog. تنشأ سياسات تقييدية `subscription_staff_active` على جداول `public` ذات RLS، وسياسات `subscription_row_active` على جداول `public` ذات RLS وعمود `tenant_id` من نوع UUID، عدا `tenant_subscriptions`، وسياسة بالاسم نفسه على `public.tenants`.

**تعريفات مستبدلة:** تستبدل الحلقة أجسام دوال عامة مختارة بأغلفة تتحقق من الاشتراك، مع بقاء التواقيع وOID. قائمة الدوال والجداول الكاملة تتحدد من مخطط قاعدة البيانات لحظة التنفيذ ولا يسردها الملف.

**ما يمكن إسقاطه عند الرجوع:** يمكن حذف السياسات بعد جرد العلاقات المتأثرة. لا يُحذف schema الخاص قبل فك اعتماديات الترحيلين 4 و8. يجب استعادة أجسام الدوال العامة وخصائصها ومالكيها وACLs من لقطة سابقة؛ إسقاط النسخ/المخطط وحده لا يعيد التعريفات الأصلية.

### 4. `20261122040000_account_deletion_guards.sql`

**جديد:** جدول `public.platform_staff_guard_versions`؛ الدوال `platform_lock_staff_guard(uuid)`, `platform_staff_auth_login_allowed(uuid)`, `platform_assert_other_admin(uuid,uuid)`, `platform_guard_staff_block()`, `platform_guard_staff_profile()`, `platform_guard_cashier_lifecycle()`, `platform_guard_open_cashier_shift()`, `platform_guard_auth_retention()`؛ ومشغّلات هذه الأسماء على التوالي على `platform_user_blocks`, `profiles`, `cashiers`, `cashier_sessions`, و`auth.users` وفق أسماء targets في ملف الترحيل.

**تعريفات مستبدلة:** `servio_subscription_private.deactivate_cashier(uuid)`, `public.platform_current_user_allowed()`, `public.platform_prepare_user_deletion(uuid,uuid)`.

**ما يمكن إسقاطه عند الرجوع:** يمكن إزالة الجدول والدوال/المشغّلات الجديدة بعد التحقق من الاعتماديات، مع تصدير بيانات `platform_staff_guard_versions` وأي بيانات fences ذات صلة. يجب استعادة التعريفات السابقة للدوال الثلاث المستبدلة؛ تعريفات الدالتين العامتين موجودة في الترحيل 2، أما تعريف/ACL الدالة الخاصة فيلزم إثباته من snapshot. لا تُحذف سجلات الحواجز أو تُلغَ عشوائيًا لأنها قد تعيد صلاحية جلسات قديمة.

### 5. `20261122050000_subscription_audit.sql`

**جديد:** `public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz)`.

**تعريفات مستبدلة:** `public.platform_owner_audit_event(uuid,uuid,uuid,text,text)` و`public.owner_set_subscription(uuid,text,timestamptz,timestamptz)`؛ ويُعاد ضبط ACL وفق الملف. تُرسل إشارة إعادة تحميل schema إلى PostgREST.

**ما يمكن إسقاطه عند الرجوع:** يمكن إسقاط الدالة الجديدة بعد التأكد من عدم استدعائها. استعادة أجسام الدالتين المستبدلتين ممكنة بالرجوع إلى تعريفيهما في الترحيلين 2 و1 على التوالي، لكن يجب استعادة الـowner والـACL الفعليين. لا تمسح سجلات التدقيق التي أضيفت بعد الترحيل.

### 6. `20261122060000_harden_legacy_rpc_privileges.sql`

**لا ينشئ كائنات دائمة.** يسحب ACL عن `public.create_tenant_for_registration(text,text,text,text,text)` و`public.refresh_cashier_session_totals(uuid)` من `PUBLIC`, `anon`, `authenticated`، ويغير `search_path` للدالتين `public.guard_ready_order_payment_state()` و`public.guard_unpaid_completion_state()` إلى فارغ. يتحقق من صلاحية trigger `public.sync_cashier_session_totals_from_order()` الموجود دون إنشائه. الجدول المؤقت `cashier_session_service_acl` يزول عند نهاية المعاملة.

**ما يمكن عكسه:** لا تُسقط الدوال؛ استعادة `search_path` وACL تحتاج القيم السابقة من catalog/لقطة قبل الترحيل، ولا ينبغي إعادة المنح بالتخمين.

### 7. `20261122070000_subscription_status.sql`

**جديد:** `public.platform_current_subscription_status()`، مع منح تنفيذ لـ`authenticated` وفق الملف.

**ما يمكن إسقاطه:** يمكن إسقاط الدالة والمنح المرتبطة بعد إيقاف كل مستهلك لها. لا يغيّر هذا الترحيل بيانات.

### 8. `20261122080000_secure_cashier_sessions.sql`

**سياسات جديدة:** `cashier_sessions_no_api_insert`, `cashier_sessions_no_api_update`, `cashier_sessions_no_api_delete` على `public.cashier_sessions`.

**تعريفات مستبدلة/ACL:** يستبدل `servio_subscription_private.refresh_cashier_session_totals(uuid)`, `servio_subscription_private.open_cashier_session(numeric)`, و`servio_subscription_private.close_cashier_session(uuid,numeric,text)`. يسحب صلاحيات محددة عن الجدول، ويحفظ ويعيد بعض صلاحيات `service_role`، ويسقط سياستي `cashier_sessions_insert` و`cashier_sessions_update` إن وُجدتا.

**ما يمكن إسقاطه:** بعد توثيق الحالة المطلوبة، أزل السياسات الجديدة وأعد ACL الجدول وتعريفي السياستين السابقتين. يجب استعادة أجسام الدوال الخاصة من snapshot. لا يكفي إسقاط الدوال أو السياسات الجديدة؛ كما أن ACL الفعلي قبل الترحيل لا يُستنتج بأمان من SQL وحده.

### 9. `20261122090000_secure_order_payload.sql`

**تعريف/مشغّلات:** يستبدل `public.canonicalize_new_order_labels()` ويسحب صلاحية تنفيذها عن الأدوار المحددة في SQL، ثم يسقط ويعيد إنشاء `orders_secure_insert_item_labels` و`orders_secure_update_item_labels` على `public.orders`.

**ما يمكن إسقاطه:** لا تُسقط الدالة أو المشغّلين قبل إثبات تعريف ما قبل الترحيل؛ `DROP TRIGGER IF EXISTS` قد يكون أزال تعريفًا سابقًا بالاسم نفسه. استعادة الدالة وACL والمشغّلين تتطلب snapshot/تعريفات سابقة. لا يوجد تعديل للطلبات التاريخية في نص هذا الترحيل.

### 10. `20261122100000_owner_user_blocks_realtime.sql`

**جديد:** سياسة `platform_user_not_blocked_realtime` لـ`SELECT` على `realtime.messages` لدور `authenticated`.

**ما يمكن إسقاطه:** يمكن حذف السياسة فقط بعد التأكد من أنها السياسة التي أنشأها هذا الترحيل وتقييم سياسة Realtime المطلوبة. لا توجد تغييرات بيانات أخرى مذكورة.

### 11. `20261122110000_owner_subscription_idempotent_v1.sql`

**جديد:** جدول `public.platform_subscription_idempotency`، والدالة `public.owner_set_subscription_idempotent_v1(uuid,text,timestamptz,timestamptz,uuid)` مع RLS/ACL حسب الملف.

**تغييرات ACL:** يسحب صلاحيات من `public.owner_set_subscription(uuid,text,timestamptz,timestamptz)` و`public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz)`.

**ما يمكن إسقاطه:** يمكن إزالة الدالة الجديدة بعد إيقاف كل مستهلكيها. لا يُسقط جدول مفاتيح idempotency قبل تصديرها واتخاذ قرار بشأن تكرار الطلبات، لأن إسقاطه يفقد سجل منع التكرار. استعادة ACL القديم لا تتم إلا من سجل سابق؛ إعادة تمكين المسارات القديمة تعطل ضمان idempotency.

## ما يلزم قبل اعتبار الرجوع قابلًا للتنفيذ

- snapshot قبل التغيير لتعريفات الدوال وأجسامها ومالكيها وخصائصها وACL، والسياسات والمشغّلات وACL/RLS للجداول، بما يشمل ما تتغير ديناميكيًا في الترحيلين 2 و3.
- تسجيل قيمة `authenticator.pgrst.db_pre_request` السابقة، وقائمة الجداول والسياسات الفعلية التي طالتها الحلقات، وACLs الفعلية لجدول `cashier_sessions`.
- خطة بيانات منفصلة للاشتراكات والفروع الجديدة، والسجلات وحواجز الجلسات، والجلسات التي حُذفت من `auth.sessions`، ومفاتيح idempotency. لا تحذف بيانات التدقيق أو الحظر أو الحذف دون قرار احتفاظ صريح.
- ترتيب رجوع عكسي مجرّب يراعي توافق الواجهة وEdge Functions قبل إسقاط RPCs/تغيير ACL؛ تجنب `DROP ... CASCADE`.
- فحص Production الفعلي قبل أي خطوة لتأكيد أن migrations ما زالت غير مطبقة وأن المخطط/البيانات لم يتغيرا عن نقطة المراجعة. لا توجد بيئة staging معزولة متاحة، ولم يُؤذن بإنشاء واحدة مدفوعة.

**الخلاصة:** بعض الكائنات الجديدة المذكورة أعلاه يمكن إسقاطها بعد فك الاعتماديات، لكن توجد أيضًا كائنات قديمة مستبدلة، وسياسات/صلاحيات أزيلت، وآثار بيانات لا ينعكس أثرها بالحذف. لذلك لا توجد الآن قائمة حذف وحدها تحقق الرجوع الآمن، ولا يجوز تطبيق الترحيلات الإنتاجية إلى أن تتوفر snapshots وخطة استعادة/توافق مجرّبة وموافقة منفصلة على الكتابة.
