<?php
$uri = $_SERVER['REQUEST_URI'];
function dump($d){
    echo '<pre>';
    var_dump($d);
    echo '<pre>';
}
//dump($_SERVER);

//echo $uri, strlen($uri), $uri[strlen($uri)-1];
if($uri[strlen($uri)-1] == '/'){ //如果是目录
    $isRoot = ($uri == '/');
    $path = $_SERVER['DOCUMENT_ROOT'].$uri;
    $files = scandir($path);
}else{
    $uri .= '/';
    $path = $_SERVER['DOCUMENT_ROOT'].$uri;
    if(is_dir($path)){
        $files = scandir($path);
    }else{
        return false;
    }
}
?>

<!DOCTYPE html>
<html>
<head>
	<title><?php echo $uri?></title>
</head>
<body>
<h1><?php echo $uri?></h1>

<table><tbody>
<?php if(!$isRoot){?>
<!--<tr><td><a href="../">Back To Parent ..</a></td></tr>-->
<?php }?>
<?php foreach ($files as $item){?>
    <?if ($item != '.'){?>
    <tr><td>
        <a href="<?php echo $uri.$item?>">/<?php echo $item?></a>
    </td></tr>
    <?php }?>
<?php }?>
<tr>
    <td style="color:#999;padding-top: 20px;">path:<?php echo $path?></td>
</tr>
</tbody></table>
</body>
</html>