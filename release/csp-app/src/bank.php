<?php
/** Question selection and marking against the server-only bank. */
declare(strict_types=1);

namespace Csp;

final class Bank
{
    private static ?array $bank = null;

    /** @return array{version:string,optionKeys:list<string>,categories:array<string,array{label:string,bankCount:int,chapters:list<int>}>,questions:array<string,array{id:string,category:string,prompt:string,options:array<string,string>,correct:string}>} */
    public static function data(): array
    {
        return self::$bank ??= require CSP_APP_DIR . '/data/questionBank.php';
    }

    public static function version(): string
    {
        return self::data()['version'];
    }

    public static function question(string $id): array
    {
        $q = self::data()['questions'][$id] ?? null;
        if (!$q) throw new \RuntimeException("Unknown question {$id}");
        return $q;
    }
}

/**
 * Per-category counts for an attempt of $total questions, proportional to the
 * bank blueprint (largest remainder, ties broken by category order).
 * For 30 of 40 this gives 3,4,4,4,3,4,3,2,3.
 * @return array<string, int>
 */
function category_quotas(int $total): array
{
    $cats = Bank::data()['categories'];
    $bankTotal = array_sum(array_column($cats, 'bankCount'));
    if ($total > $bankTotal) throw new \RuntimeException("Cannot select {$total} from a bank of {$bankTotal}");
    $keys = array_keys($cats);
    $exact = array_map(fn ($c) => ($cats[$c]['bankCount'] * $total) / $bankTotal, $keys);
    $quotas = array_map(fn ($x) => (int) floor($x), $exact);
    $remaining = $total - array_sum($quotas);
    $order = array_keys($keys);
    usort($order, fn ($a, $b) => (($exact[$b] - $quotas[$b]) <=> ($exact[$a] - $quotas[$a])) ?: ($a <=> $b));
    foreach ($order as $i) {
        if ($remaining === 0) break;
        $quotas[$i] += 1;
        $remaining -= 1;
    }
    return array_combine($keys, $quotas);
}

/**
 * Fresh random selection, question order and option order for one attempt.
 * @return list<array{id:string,options:list<string>}>
 */
function select_questions(int $total): array
{
    $bank = Bank::data();
    $chosen = [];
    foreach (category_quotas($total) as $category => $count) {
        $pool = array_values(array_filter($bank['questions'], fn ($q) => $q['category'] === $category));
        array_push($chosen, ...array_slice(shuffle_secure($pool), 0, $count));
    }
    return array_map(
        fn ($q) => ['id' => $q['id'], 'options' => shuffle_secure($bank['optionKeys'])],
        shuffle_secure($chosen),
    );
}

/** What the browser receives. No answer, no explanation. */
function public_questions(array $served): array
{
    $cats = Bank::data()['categories'];
    $out = [];
    foreach (array_values($served) as $index => $s) {
        $q = Bank::question($s['id']);
        $out[] = [
            'id' => $q['id'],
            'number' => $index + 1,
            'category' => $cats[$q['category']]['label'],
            'prompt' => $q['prompt'],
            'options' => array_map(fn ($key) => ['key' => $key, 'text' => $q['options'][$key]], $s['options']),
        ];
    }
    return $out;
}

/**
 * Keeps only answers to questions in this attempt with a valid option key.
 * Anything else the client sends is ignored.
 * @return array<string, string>
 */
function sanitise_answers(array $served, mixed $input): array
{
    $out = [];
    if (!is_array($input) || ($input !== [] && array_is_list($input))) return $out;
    $allowed = array_flip(array_column($served, 'id'));
    foreach ($input as $id => $value) {
        if (is_string($id) && isset($allowed[$id]) && is_string($value) && in_array($value, ['a', 'b', 'c', 'd'], true)) $out[$id] = $value;
    }
    return $out;
}

/**
 * Marks against the server-side key. Unanswered questions count as incorrect.
 * @return array{responses:list<array{question_id:string,selected_option:?string,is_correct:bool}>,correct:int,total:int,breakdown:array<string,array{label:string,correct:int,total:int}>}
 */
function mark_attempt(array $served, array $answers): array
{
    $cats = Bank::data()['categories'];
    $breakdown = [];
    $responses = [];
    $correct = 0;
    foreach ($served as $s) {
        $q = Bank::question($s['id']);
        $selected = $answers[$s['id']] ?? null;
        $isCorrect = $selected === $q['correct'];
        if ($isCorrect) $correct += 1;
        $responses[] = ['question_id' => $q['id'], 'selected_option' => $selected, 'is_correct' => $isCorrect];
        $breakdown[$q['category']] ??= ['label' => $cats[$q['category']]['label'], 'correct' => 0, 'total' => 0];
        $breakdown[$q['category']]['total'] += 1;
        if ($isCorrect) $breakdown[$q['category']]['correct'] += 1;
    }
    return ['responses' => $responses, 'correct' => $correct, 'total' => count($served), 'breakdown' => $breakdown];
}
