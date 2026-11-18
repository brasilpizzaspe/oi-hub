alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category = any (array['Salgadas'::text, 'Doces'::text, 'Bebidas'::text, 'Promoções'::text]));

update public.products set description = case id
  when 'mussarela' then 'Molho de tomate, mussarela e orégano.'
  when 'calabresa' then 'Molho de tomate, mussarela, calabresa, cebola, azeitona e orégano.'
  when 'frango-requeijao' then 'Molho de tomate, mussarela, frango cozido desfiado, requeijão culinário e orégano.'
  when 'portuguesa' then 'Molho de tomate, mussarela, presunto, ovo cozido, cebola, ervilha e azeitona.'
  when 'marguerita' then 'Molho de tomate, mussarela, tomate, parmesão e manjericão.'
  when 'bacon' then 'Molho de tomate, mussarela, bacon, cebola e orégano.'
  when 'chocolate' then 'Chocolate ao leite e granulado de chocolate.'
  when 'romeu-julieta' then 'Mussarela e goiabada.'
  else description
end
where id in ('mussarela','calabresa','frango-requeijao','portuguesa','marguerita','bacon','chocolate','romeu-julieta');
